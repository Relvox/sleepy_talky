package com.sleepy.recorder.core.codec;

import com.sleepy.recorder.core.AudioConfig;
import org.concentus.OpusApplication;
import org.concentus.OpusException;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;

/**
 * Opus encoder wrapper using Concentus library
 */
public class OpusEncoder implements AutoCloseable {
    private final org.concentus.OpusEncoder encoder;
    private final int frameSize;
    private final short[] frameBuffer;
    private int frameBufferPos;

    public OpusEncoder() throws OpusException {
        this(AudioConfig.BITRATE);
    }

    public OpusEncoder(int bitrate) throws OpusException {
        this.encoder = new org.concentus.OpusEncoder(
                AudioConfig.SAMPLE_RATE,
                AudioConfig.CHANNELS,
                OpusApplication.OPUS_APPLICATION_AUDIO
        );
        this.encoder.setBitrate(bitrate);

        this.frameSize = AudioConfig.FRAME_SIZE_SAMPLES;
        this.frameBuffer = new short[frameSize];
        this.frameBufferPos = 0;
    }

    /**
     * Encode PCM audio data to Opus packets
     * @param pcmData Raw PCM data (16-bit signed little-endian)
     * @param outputStream Stream to write encoded packets to
     * @return Number of bytes written
     */
    public int encode(byte[] pcmData, OutputStream outputStream) throws IOException, OpusException {
        return encode(pcmData, 0, pcmData.length, outputStream);
    }

    /**
     * Encode PCM audio data to Opus packets
     * @param pcmData Raw PCM data (16-bit signed little-endian)
     * @param offset Offset in pcmData
     * @param length Number of bytes to read
     * @param outputStream Stream to write encoded packets to
     * @return Number of bytes written
     */
    public int encode(byte[] pcmData, int offset, int length, OutputStream outputStream)
            throws IOException, OpusException {
        int totalBytesWritten = 0;
        ByteBuffer buffer = ByteBuffer.wrap(pcmData, offset, length);
        buffer.order(ByteOrder.LITTLE_ENDIAN);

        // Convert bytes to shorts and fill frame buffer
        while (buffer.remaining() >= 2) {
            frameBuffer[frameBufferPos++] = buffer.getShort();

            // When we have a complete frame, encode it
            if (frameBufferPos == frameSize) {
                byte[] packet = new byte[AudioConfig.MAX_PACKET_SIZE];
                int packetSize = encoder.encode(frameBuffer, 0, frameSize, packet, 0, packet.length);

                if (packetSize > 0) {
                    outputStream.write(packet, 0, packetSize);
                    totalBytesWritten += packetSize;
                }

                frameBufferPos = 0;
            }
        }

        return totalBytesWritten;
    }

    /**
     * Flush any remaining audio data in the buffer
     */
    public int flush(OutputStream outputStream) throws IOException, OpusException {
        if (frameBufferPos > 0) {
            // Pad with silence if needed
            while (frameBufferPos < frameSize) {
                frameBuffer[frameBufferPos++] = 0;
            }

            byte[] packet = new byte[AudioConfig.MAX_PACKET_SIZE];
            int packetSize = encoder.encode(frameBuffer, 0, frameSize, packet, 0, packet.length);

            if (packetSize > 0) {
                outputStream.write(packet, 0, packetSize);
                frameBufferPos = 0;
                return packetSize;
            }
        }
        return 0;
    }

    @Override
    public void close() {
        // Concentus encoder doesn't need explicit cleanup
    }
}
