package com.sleepy.recorder.core.codec;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.zip.CRC32;

/**
 * Writes Opus packets into an Ogg container format.
 * Implements the Ogg Opus specification (RFC 7845).
 */
public class OggOpusWriter implements AutoCloseable {

    private static final byte[] OGG_MAGIC = { 'O', 'g', 'g', 'S' };
    private static final int MAX_PAGE_SIZE = 65025; // 255 segments * 255 bytes
    private static final int MAX_LACING_VALUE = 255;

    private final OutputStream output;
    private final int sampleRate;
    private final int channels;
    private int serialNumber;
    private int sequenceNumber;
    private long granulePosition;

    public OggOpusWriter(OutputStream output, int sampleRate, int channels) {
        this.output = output;
        this.sampleRate = sampleRate;
        this.channels = channels;
        this.serialNumber = (int) (System.currentTimeMillis() & 0x7FFFFFFF);
        this.sequenceNumber = 0;
        this.granulePosition = 0;
    }

    /**
     * Write the Ogg Opus ID header (OpusHead)
     */
    public void writeHeaders() throws IOException {
        // OpusHead packet
        ByteBuffer idHeader = ByteBuffer.allocate(19);
        idHeader.order(ByteOrder.LITTLE_ENDIAN);
        idHeader.put("OpusHead".getBytes()); // Magic signature
        idHeader.put((byte) 1); // Version
        idHeader.put((byte) channels); // Channel count
        idHeader.putShort((short) 0); // Pre-skip (3840 samples at 48kHz = 80ms)
        idHeader.putInt(sampleRate); // Original sample rate
        idHeader.putShort((short) 0); // Output gain (0 dB)
        idHeader.put((byte) 0); // Channel mapping family (0 = mono/stereo)

        writePage(idHeader.array(), 0, true, false, false);

        // OpusTags packet (comment header)
        String vendor = "Sleepy Recorder";
        ByteBuffer tagsHeader = ByteBuffer.allocate(
            8 + 4 + vendor.length() + 4
        );
        tagsHeader.order(ByteOrder.LITTLE_ENDIAN);
        tagsHeader.put("OpusTags".getBytes()); // Magic signature
        tagsHeader.putInt(vendor.length()); // Vendor string length
        tagsHeader.put(vendor.getBytes()); // Vendor string
        tagsHeader.putInt(0); // User comment list length (no comments)

        writePage(tagsHeader.array(), 0, false, false, false);
    }

    /**
     * Write an Opus audio packet
     * @param packet Encoded Opus packet
     * @param samplesInPacket Number of PCM samples represented by this packet (for granule position)
     */
    public void writeAudioPacket(byte[] packet, int samplesInPacket)
        throws IOException {
        granulePosition += samplesInPacket;
        writePage(packet, granulePosition, false, false, false);
    }

    /**
     * Finalize the stream (write final page)
     */
    public void finalizeStream() throws IOException {
        // Write an empty final page with EOS flag
        writePage(new byte[0], granulePosition, false, false, true);
        output.flush();
    }

    /**
     * Write an Ogg page
     */
    private void writePage(
        byte[] data,
        long granulePos,
        boolean bos,
        boolean continued,
        boolean eos
    ) throws IOException {
        // Build header type flags
        byte headerType = 0;
        if (continued) headerType |= 0x01;
        if (bos) headerType |= 0x02;
        if (eos) headerType |= 0x04;

        // Calculate segment table
        int numSegments =
            (data.length + MAX_LACING_VALUE - 1) / MAX_LACING_VALUE;
        if (data.length == 0) numSegments = 1; // At least one segment for empty packets

        byte[] segmentTable = new byte[numSegments];
        int remaining = data.length;
        for (int i = 0; i < numSegments; i++) {
            if (remaining >= MAX_LACING_VALUE) {
                segmentTable[i] = (byte) MAX_LACING_VALUE;
                remaining -= MAX_LACING_VALUE;
            } else {
                segmentTable[i] = (byte) remaining;
                remaining = 0;
            }
        }

        // Build page header (without CRC)
        ByteBuffer header = ByteBuffer.allocate(27 + numSegments);
        header.order(ByteOrder.LITTLE_ENDIAN);
        header.put(OGG_MAGIC); // Capture pattern
        header.put((byte) 0); // Stream structure version
        header.put(headerType); // Header type flags
        header.putLong(granulePos); // Granule position
        header.putInt(serialNumber); // Bitstream serial number
        header.putInt(sequenceNumber); // Page sequence number
        header.putInt(0); // CRC checksum (placeholder)
        header.put((byte) numSegments); // Number of page segments
        header.put(segmentTable); // Segment table

        // Calculate CRC
        CRC32 crc = new CRC32();
        crc.update(header.array());
        crc.update(data);
        long crcValue = crc.getValue();

        // Write CRC into header
        header.putInt(22, (int) crcValue);

        // Write page to output
        output.write(header.array());
        output.write(data);

        sequenceNumber++;
    }

    @Override
    public void close() throws IOException {
        output.close();
    }
}
