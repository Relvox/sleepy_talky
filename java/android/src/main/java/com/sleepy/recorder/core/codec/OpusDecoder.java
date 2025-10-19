package com.sleepy.recorder.core.codec;

import com.sleepy.recorder.core.AudioConfig;
import org.concentus.OpusException;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;

/**
 * Opus decoder wrapper using Concentus library
 */
public class OpusDecoder implements AutoCloseable {
    private final org.concentus.OpusDecoder decoder;
    private final int frameSize;

    public OpusDecoder() throws OpusException {
        this.decoder = new org.concentus.OpusDecoder(
                AudioConfig.SAMPLE_RATE,
                AudioConfig.CHANNELS
        );
        this.frameSize = AudioConfig.FRAME_SIZE_SAMPLES;
    }

    /**
     * Decode an Opus packet to PCM audio data
     * @param packet Encoded Opus packet
     * @param packetLength Length of the packet
     * @return PCM data as 16-bit signed little-endian bytes
     */
    public byte[] decode(byte[] packet, int packetLength) throws OpusException {
        short[] pcmBuffer = new short[frameSize * 2]; // Allow for larger frames

        int samplesDecoded = decoder.decode(
                packet, 0, packetLength,
                pcmBuffer, 0, pcmBuffer.length,
                false
        );

        // Convert shorts to bytes (little-endian)
        ByteBuffer buffer = ByteBuffer.allocate(samplesDecoded * 2);
        buffer.order(ByteOrder.LITTLE_ENDIAN);
        for (int i = 0; i < samplesDecoded; i++) {
            buffer.putShort(pcmBuffer[i]);
        }

        return buffer.array();
    }

    /**
     * Get the expected frame size in samples
     */
    public int getFrameSize() {
        return frameSize;
    }

    @Override
    public void close() {
        // Concentus decoder doesn't need explicit cleanup
    }
}
