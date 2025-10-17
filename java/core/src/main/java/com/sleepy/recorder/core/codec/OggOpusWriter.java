package com.sleepy.recorder.core.codec;

import com.sleepy.recorder.core.AudioConfig;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.Random;

/**
 * Writes Opus packets to Ogg container format
 * Based on RFC 7845 (Ogg Encapsulation for the Opus Audio Codec)
 */
public class OggOpusWriter implements AutoCloseable {
    private static final byte[] OGG_MAGIC = {'O', 'g', 'g', 'S'};
    private static final int MAX_SEGMENT_SIZE = 255;
    private static final int MAX_PAGE_SIZE = 65025; // 255 segments * 255 bytes

    private final OutputStream output;
    private final int serialNumber;
    private int sequenceNumber;
    private long granulePosition;
    private boolean headerWritten;
    private boolean closed;

    public OggOpusWriter(OutputStream output) {
        this.output = output;
        this.serialNumber = new Random().nextInt();
        this.sequenceNumber = 0;
        this.granulePosition = 0;
        this.headerWritten = false;
        this.closed = false;
    }

    /**
     * Write the Ogg Opus header pages (ID header + Comment header)
     */
    public void writeHeaders() throws IOException {
        if (headerWritten) {
            return;
        }

        // Write ID Header
        writeIdHeader();

        // Write Comment Header
        writeCommentHeader();

        headerWritten = true;
    }

    private void writeIdHeader() throws IOException {
        ByteBuffer header = ByteBuffer.allocate(19);
        header.order(ByteOrder.LITTLE_ENDIAN);

        // OpusHead
        header.put("OpusHead".getBytes());
        header.put((byte) 1); // Version
        header.put((byte) AudioConfig.CHANNELS); // Channel count
        header.putShort((short) 0); // Pre-skip (0 for simplicity)
        header.putInt(AudioConfig.SAMPLE_RATE); // Original sample rate
        header.putShort((short) 0); // Output gain (0 dB)
        header.put((byte) 0); // Channel mapping family (0 = mono/stereo)

        writeOggPage(header.array(), 0, true, false);
    }

    private void writeCommentHeader() throws IOException {
        String vendor = "Sleepy Recorder";
        ByteBuffer header = ByteBuffer.allocate(8 + 4 + vendor.length() + 4);
        header.order(ByteOrder.LITTLE_ENDIAN);

        // OpusTags
        header.put("OpusTags".getBytes());
        header.putInt(vendor.length());
        header.put(vendor.getBytes());
        header.putInt(0); // User comment list length

        writeOggPage(header.array(), 0, false, false);
    }

    /**
     * Write an Opus packet to the Ogg stream
     */
    public void writePacket(byte[] packet, int length) throws IOException {
        if (!headerWritten) {
            writeHeaders();
        }

        // Update granule position (samples encoded)
        granulePosition += AudioConfig.FRAME_SIZE_SAMPLES;

        writeOggPage(packet, length, false, false);
    }

    /**
     * Write an Ogg page
     */
    private void writeOggPage(byte[] data, int length, boolean isBeginOfStream, boolean isEndOfStream)
            throws IOException {
        if (length > MAX_PAGE_SIZE) {
            throw new IOException("Packet too large for single Ogg page: " + length);
        }

        // Calculate number of segments
        int numSegments = (length + MAX_SEGMENT_SIZE - 1) / MAX_SEGMENT_SIZE;
        if (numSegments == 0) {
            numSegments = 1;
        }

        // Build Ogg page header (27 bytes + segment table)
        ByteBuffer pageHeader = ByteBuffer.allocate(27 + numSegments);
        pageHeader.order(ByteOrder.LITTLE_ENDIAN);

        // Capture pattern
        pageHeader.put(OGG_MAGIC);

        // Version
        pageHeader.put((byte) 0);

        // Header type flags
        byte headerType = 0;
        if (isBeginOfStream) headerType |= 0x02;
        if (isEndOfStream) headerType |= 0x04;
        pageHeader.put(headerType);

        // Granule position
        pageHeader.putLong(granulePosition);

        // Serial number
        pageHeader.putInt(serialNumber);

        // Sequence number
        pageHeader.putInt(sequenceNumber++);

        // CRC (placeholder, will calculate later)
        int crcPos = pageHeader.position();
        pageHeader.putInt(0);

        // Number of segments
        pageHeader.put((byte) numSegments);

        // Segment table
        int remaining = length;
        for (int i = 0; i < numSegments; i++) {
            int segmentSize = Math.min(remaining, MAX_SEGMENT_SIZE);
            pageHeader.put((byte) segmentSize);
            remaining -= segmentSize;
        }

        byte[] headerBytes = pageHeader.array();

        // Calculate CRC
        int crc = calculateCrc(headerBytes, data, length);
        ByteBuffer.wrap(headerBytes, crcPos, 4).order(ByteOrder.LITTLE_ENDIAN).putInt(crc);

        // Write page
        output.write(headerBytes);
        output.write(data, 0, length);
    }

    /**
     * Calculate CRC-32 for Ogg page
     */
    private int calculateCrc(byte[] header, byte[] data, int dataLength) {
        int crc = 0;

        for (byte b : header) {
            crc = (crc << 8) ^ CRC_LOOKUP[(crc >>> 24) ^ (b & 0xFF)];
        }

        for (int i = 0; i < dataLength; i++) {
            crc = (crc << 8) ^ CRC_LOOKUP[(crc >>> 24) ^ (data[i] & 0xFF)];
        }

        return crc;
    }

    @Override
    public void close() throws IOException {
        if (!closed) {
            // Write final page with end-of-stream flag
            writeOggPage(new byte[0], 0, false, true);
            output.close();
            closed = true;
        }
    }

    // CRC lookup table for Ogg
    private static final int[] CRC_LOOKUP = new int[256];
    static {
        for (int i = 0; i < 256; i++) {
            int r = i << 24;
            for (int j = 0; j < 8; j++) {
                if ((r & 0x80000000) != 0) {
                    r = (r << 1) ^ 0x04c11db7;
                } else {
                    r <<= 1;
                }
            }
            CRC_LOOKUP[i] = r;
        }
    }
}
