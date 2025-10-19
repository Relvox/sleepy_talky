package com.sleepy.recorder.core.codec;

import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.Arrays;

/**
 * Reads Opus packets from Ogg container format
 */
public class OggOpusReader implements AutoCloseable {
    private static final byte[] OGG_MAGIC = {'O', 'g', 'g', 'S'};

    private final InputStream input;
    private boolean headersRead;
    private long granulePosition;
    private int preSkip;

    public OggOpusReader(InputStream input) {
        this.input = input;
        this.headersRead = false;
        this.granulePosition = 0;
        this.preSkip = 0;
    }

    /**
     * Read and validate Ogg Opus headers
     */
    public void readHeaders() throws IOException {
        if (headersRead) {
            return;
        }

        // Read ID header page
        OggPage idPage = readPage();
        if (idPage == null || idPage.data.length < 19) {
            throw new IOException("Invalid Ogg Opus file: missing ID header");
        }

        // Validate OpusHead signature
        byte[] opusHead = Arrays.copyOfRange(idPage.data, 0, 8);
        if (!Arrays.equals(opusHead, "OpusHead".getBytes())) {
            throw new IOException("Invalid Ogg Opus file: invalid OpusHead signature");
        }

        // Parse pre-skip
        ByteBuffer buffer = ByteBuffer.wrap(idPage.data);
        buffer.order(ByteOrder.LITTLE_ENDIAN);
        buffer.position(10); // Skip to pre-skip field
        this.preSkip = buffer.getShort() & 0xFFFF;

        // Read Comment header page
        OggPage commentPage = readPage();
        if (commentPage == null || commentPage.data.length < 8) {
            throw new IOException("Invalid Ogg Opus file: missing comment header");
        }

        headersRead = true;
    }

    /**
     * Read next Opus packet
     * @return Opus packet data, or null if end of stream
     */
    public byte[] readPacket() throws IOException {
        if (!headersRead) {
            readHeaders();
        }

        OggPage page = readPage();
        if (page == null) {
            return null;
        }

        granulePosition = page.granulePosition;
        return page.data;
    }

    /**
     * Read an Ogg page
     */
    private OggPage readPage() throws IOException {
        // Read page header (27 bytes minimum)
        byte[] header = new byte[27];
        if (!readFully(header)) {
            return null; // End of stream
        }

        // Verify capture pattern
        if (!Arrays.equals(Arrays.copyOfRange(header, 0, 4), OGG_MAGIC)) {
            throw new IOException("Invalid Ogg page: bad magic");
        }

        // Parse header
        ByteBuffer headerBuffer = ByteBuffer.wrap(header);
        headerBuffer.order(ByteOrder.LITTLE_ENDIAN);

        headerBuffer.position(5); // Skip to header type
        byte headerType = headerBuffer.get();
        long granulePos = headerBuffer.getLong();
        int serialNumber = headerBuffer.getInt();
        int sequenceNumber = headerBuffer.getInt();
        int crc = headerBuffer.getInt();
        int numSegments = headerBuffer.get() & 0xFF;

        // Read segment table
        byte[] segmentTable = new byte[numSegments];
        if (!readFully(segmentTable)) {
            throw new IOException("Unexpected end of stream in segment table");
        }

        // Calculate total page data size
        int pageDataSize = 0;
        for (byte segment : segmentTable) {
            pageDataSize += segment & 0xFF;
        }

        // Read page data
        byte[] pageData = new byte[pageDataSize];
        if (!readFully(pageData)) {
            throw new IOException("Unexpected end of stream in page data");
        }

        return new OggPage(granulePos, pageData);
    }

    /**
     * Read exactly the specified number of bytes
     */
    private boolean readFully(byte[] buffer) throws IOException {
        int offset = 0;
        while (offset < buffer.length) {
            int bytesRead = input.read(buffer, offset, buffer.length - offset);
            if (bytesRead < 0) {
                return false; // End of stream
            }
            offset += bytesRead;
        }
        return true;
    }

    /**
     * Get current granule position (sample position)
     */
    public long getGranulePosition() {
        return granulePosition;
    }

    /**
     * Get pre-skip value from header
     */
    public int getPreSkip() {
        return preSkip;
    }

    @Override
    public void close() throws IOException {
        input.close();
    }

    /**
     * Internal class representing an Ogg page
     */
    private static class OggPage {
        final long granulePosition;
        final byte[] data;

        OggPage(long granulePosition, byte[] data) {
            this.granulePosition = granulePosition;
            this.data = data;
        }
    }
}
