package com.sleepy.recorder.android;

import com.sleepy.recorder.core.AudioConfig;
import com.sleepy.recorder.core.codec.OggOpusReader;
import com.sleepy.recorder.core.codec.OpusDecoder;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/**
 * Android-compatible audio decoder (no javax.sound dependencies)
 * Only supports Ogg Opus format
 */
public class AndroidAudioDecoder {

    /**
     * Decode Ogg Opus file to PCM chunks
     */
    public static List<PcmChunk> decode(
        File audioFile,
        ProgressCallback progressCallback
    ) throws IOException {
        if (!isOpusFile(audioFile)) {
            throw new IOException(
                "Only Ogg Opus files are supported on Android"
            );
        }

        List<PcmChunk> chunks = new ArrayList<>();

        try (
            FileInputStream fis = new FileInputStream(audioFile);
            OggOpusReader reader = new OggOpusReader(fis);
            OpusDecoder decoder = new OpusDecoder()
        ) {
            reader.readHeaders();

            long currentTimeMs = 0;
            byte[] packet;
            long totalBytes = audioFile.length();
            int packetCount = 0;

            while ((packet = reader.readPacket()) != null) {
                packetCount++;
                byte[] pcmData = decoder.decode(packet, packet.length);

                chunks.add(new PcmChunk(currentTimeMs, pcmData));

                // Update time based on sample count
                int sampleCount = pcmData.length / 2; // 16-bit = 2 bytes per sample
                currentTimeMs +=
                    (sampleCount * 1000L) / AudioConfig.SAMPLE_RATE;

                // Report progress
                if (progressCallback != null) {
                    double progress = Math.min(
                        1.0,
                        (double) fis.getChannel().position() / totalBytes
                    );
                    progressCallback.onProgress(progress);
                }
            }
        } catch (Exception e) {
            throw new IOException(
                "Failed to decode Opus file: " + e.getMessage(),
                e
            );
        }

        return chunks;
    }

    /**
     * Calculate RMS volume from PCM data
     */
    public static double calculateRms(byte[] pcmData) {
        double sumSquares = 0;
        int sampleCount = 0;

        for (int i = 0; i < pcmData.length - 1; i += 2) {
            // Little-endian 16-bit PCM
            short sample = (short) ((pcmData[i] & 0xFF) |
                ((pcmData[i + 1] & 0xFF) << 8));
            double normalized = sample / 32768.0; // Normalize to -1.0 to 1.0
            sumSquares += normalized * normalized;
            sampleCount++;
        }

        return sampleCount > 0 ? Math.sqrt(sumSquares / sampleCount) : 0;
    }

    /**
     * Check if file is an Opus file by reading the Ogg header
     */
    private static boolean isOpusFile(File file) {
        try (FileInputStream fis = new FileInputStream(file)) {
            byte[] header = new byte[36];
            if (fis.read(header) < 36) {
                return false;
            }

            // Check for Ogg magic: "OggS"
            if (
                header[0] != 'O' ||
                header[1] != 'g' ||
                header[2] != 'g' ||
                header[3] != 'S'
            ) {
                return false;
            }

            // Check for OpusHead signature (starts at byte 28)
            String opusHead = new String(header, 28, 8);
            return opusHead.equals("OpusHead");
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * PCM chunk with timestamp
     */
    public static class PcmChunk {

        public final long timeMs;
        public final byte[] pcmData;

        public PcmChunk(long timeMs, byte[] pcmData) {
            this.timeMs = timeMs;
            this.pcmData = pcmData;
        }
    }

    /**
     * Chunk callback interface for streaming decode
     */
    public interface ChunkCallback {
        void onChunk(long timeMs, byte[] pcmData);
    }

    /**
     * Progress callback interface
     */
    public interface ProgressCallback {
        void onProgress(double progress);
    }
}
