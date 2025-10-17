package com.sleepy.recorder.core.codec;

import com.sleepy.recorder.core.AudioConfig;
import java.io.*;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.ArrayList;
import java.util.List;
import javax.sound.sampled.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Universal audio decoder that handles multiple formats:
 * - Ogg Opus (using OggOpusReader)
 * - Ogg Vorbis (using Java Sound SPI)
 * - MP3 (using Java Sound SPI)
 * - WAV (using Java Sound API)
 * - M4A/AAC (best effort with Java Sound SPI)
 */
public class UniversalAudioDecoder {

    private static final Logger logger = LoggerFactory.getLogger(
        UniversalAudioDecoder.class
    );

    /**
     * Decode any supported audio file to 48kHz mono 16-bit PCM samples
     */
    public static List<PcmChunk> decode(
        File audioFile,
        ProgressCallback progressCallback
    ) throws IOException {
        logger.info(
            "=== Starting decode of file: {} ===",
            audioFile.getAbsolutePath()
        );
        logger.info("File size: {} bytes", audioFile.length());
        logger.info("File exists: {}", audioFile.exists());
        logger.info("File can read: {}", audioFile.canRead());

        String fileName = audioFile.getName().toLowerCase();
        logger.info(
            "File extension: {}",
            fileName.substring(fileName.lastIndexOf('.') + 1)
        );

        try {
            // For Opus files, use the specialized OggOpusReader for better performance
            if (fileName.endsWith(".opus")) {
                logger.info("Detected Opus format, using OggOpusReader");
                List<PcmChunk> result = decodeOpus(audioFile, progressCallback);
                logger.info(
                    "Successfully decoded {} PCM chunks",
                    result.size()
                );
                return result;
            }

            // For all other formats, try Java Sound API (with SPI extensions)
            logger.info("Using Java Sound API for decoding");
            listAvailableAudioFormats();
            List<PcmChunk> result = decodeWithJavaSound(
                audioFile,
                progressCallback
            );
            logger.info("Successfully decoded {} PCM chunks", result.size());
            return result;
        } catch (Exception e) {
            logger.error(
                "FATAL: Failed to decode audio file: {}",
                audioFile.getName(),
                e
            );
            logger.error("Exception type: {}", e.getClass().getName());
            logger.error("Exception message: {}", e.getMessage());
            if (e.getCause() != null) {
                logger.error("Caused by: {}", e.getCause().getMessage());
            }
            throw e;
        }
    }

    /**
     * List available audio file types and conversions for debugging
     */
    private static void listAvailableAudioFormats() {
        try {
            logger.info("--- Available Audio File Types ---");
            AudioFileFormat.Type[] types = AudioSystem.getAudioFileTypes();
            for (AudioFileFormat.Type type : types) {
                logger.info("  - {}", type.toString());
            }
        } catch (Exception e) {
            logger.warn("Could not list audio file types", e);
        }
    }

    /**
     * Decode Ogg Opus file using OggOpusReader
     */
    private static List<PcmChunk> decodeOpus(
        File audioFile,
        ProgressCallback progressCallback
    ) throws IOException {
        logger.info("Opening Opus file with OggOpusReader");
        List<PcmChunk> chunks = new ArrayList<>();

        try (
            FileInputStream fis = new FileInputStream(audioFile);
            OggOpusReader reader = new OggOpusReader(fis);
            OpusDecoder decoder = new OpusDecoder()
        ) {
            logger.info("Reading Opus headers...");
            reader.readHeaders();
            logger.info(
                "Headers read successfully, preSkip: {}",
                reader.getPreSkip()
            );

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

                if (packetCount % 100 == 0) {
                    logger.debug(
                        "Decoded {} packets, current time: {}ms",
                        packetCount,
                        currentTimeMs
                    );
                }
            }

            logger.info(
                "Decoded {} Opus packets, total duration: {}ms",
                packetCount,
                currentTimeMs
            );
        } catch (Exception e) {
            logger.error("Error decoding Opus file", e);
            throw new IOException(
                "Failed to decode Opus file: " + e.getMessage(),
                e
            );
        }

        return chunks;
    }

    /**
     * Decode any audio file using Java Sound API (WAV, MP3, OGG Vorbis, M4A)
     */
    private static List<PcmChunk> decodeWithJavaSound(
        File audioFile,
        ProgressCallback progressCallback
    ) throws IOException {
        logger.info("Attempting to decode with Java Sound API");
        List<PcmChunk> chunks = new ArrayList<>();

        try {
            // Try to get audio input stream
            logger.info("Getting audio input stream...");
            AudioInputStream sourceStream = AudioSystem.getAudioInputStream(
                audioFile
            );
            AudioFormat sourceFormat = sourceStream.getFormat();

            logger.info("Source format: {}", sourceFormat);
            logger.info("  Encoding: {}", sourceFormat.getEncoding());
            logger.info("  Sample rate: {} Hz", sourceFormat.getSampleRate());
            logger.info("  Channels: {}", sourceFormat.getChannels());
            logger.info(
                "  Bits per sample: {}",
                sourceFormat.getSampleSizeInBits()
            );
            logger.info("  Frame size: {} bytes", sourceFormat.getFrameSize());
            logger.info("  Frame rate: {}", sourceFormat.getFrameRate());
            logger.info("  Big endian: {}", sourceFormat.isBigEndian());

            // Define target format: 48kHz, 16-bit, mono, signed PCM, little-endian
            AudioFormat targetFormat = new AudioFormat(
                AudioFormat.Encoding.PCM_SIGNED,
                AudioConfig.SAMPLE_RATE, // 48000 Hz
                AudioConfig.BITS_PER_SAMPLE, // 16-bit
                AudioConfig.CHANNELS, // Mono
                (AudioConfig.CHANNELS * AudioConfig.BITS_PER_SAMPLE) / 8, // Frame size = 2 bytes
                AudioConfig.SAMPLE_RATE, // Frame rate
                false // Little-endian
            );

            logger.info("Target format: {}", targetFormat);

            // Convert to target format if needed
            AudioInputStream audioStream = sourceStream;
            if (!sourceFormat.matches(targetFormat)) {
                logger.info("Format conversion required");

                // Check if conversion is supported
                boolean directConversion = AudioSystem.isConversionSupported(
                    targetFormat,
                    sourceFormat
                );
                logger.info(
                    "Direct conversion supported: {}",
                    directConversion
                );

                if (!directConversion) {
                    logger.info("Attempting intermediate PCM conversion...");
                    // Try intermediate PCM conversion first
                    AudioFormat intermediatePcm = new AudioFormat(
                        AudioFormat.Encoding.PCM_SIGNED,
                        sourceFormat.getSampleRate(),
                        16,
                        sourceFormat.getChannels(),
                        sourceFormat.getChannels() * 2,
                        sourceFormat.getSampleRate(),
                        false
                    );

                    logger.info("Intermediate format: {}", intermediatePcm);
                    boolean intermediateConversion =
                        AudioSystem.isConversionSupported(
                            intermediatePcm,
                            sourceFormat
                        );
                    logger.info(
                        "Intermediate conversion supported: {}",
                        intermediateConversion
                    );

                    if (intermediateConversion) {
                        audioStream = AudioSystem.getAudioInputStream(
                            intermediatePcm,
                            sourceStream
                        );
                        sourceFormat = intermediatePcm;
                        logger.info(
                            "Successfully converted to intermediate format"
                        );
                    }
                }

                // Now try final conversion
                if (
                    AudioSystem.isConversionSupported(
                        targetFormat,
                        sourceFormat
                    )
                ) {
                    logger.info("Converting to target format...");
                    audioStream = AudioSystem.getAudioInputStream(
                        targetFormat,
                        audioStream
                    );
                    logger.info("Conversion successful");
                } else {
                    String errorMsg =
                        "Cannot convert audio format from " +
                        sourceFormat +
                        " to " +
                        targetFormat;
                    logger.error(errorMsg);
                    throw new IOException(errorMsg);
                }
            } else {
                logger.info("No format conversion needed");
            }

            // Read PCM data in chunks
            logger.info("Reading PCM data...");
            long currentTimeMs = 0;
            byte[] buffer = new byte[AudioConfig.FRAME_SIZE_SAMPLES * 2]; // 20ms chunks
            int bytesRead;
            long totalFrames = audioStream.getFrameLength();
            long processedFrames = 0;
            int chunkCount = 0;

            logger.info("Total frames: {}", totalFrames);

            while ((bytesRead = audioStream.read(buffer)) != -1) {
                chunkCount++;

                // Copy the actual bytes read
                byte[] chunk = new byte[bytesRead];
                System.arraycopy(buffer, 0, chunk, 0, bytesRead);

                chunks.add(new PcmChunk(currentTimeMs, chunk));

                // Update time
                int sampleCount = bytesRead / 2; // 16-bit = 2 bytes per sample
                currentTimeMs +=
                    (sampleCount * 1000L) / AudioConfig.SAMPLE_RATE;

                // Update progress
                processedFrames += sampleCount;
                if (progressCallback != null && totalFrames > 0) {
                    double progress = Math.min(
                        1.0,
                        (double) processedFrames / totalFrames
                    );
                    progressCallback.onProgress(progress);
                }

                if (chunkCount % 100 == 0) {
                    logger.debug(
                        "Read {} chunks, current time: {}ms",
                        chunkCount,
                        currentTimeMs
                    );
                }
            }

            logger.info(
                "Read {} PCM chunks, total duration: {}ms",
                chunkCount,
                currentTimeMs
            );

            audioStream.close();
        } catch (UnsupportedAudioFileException e) {
            String errorMsg =
                "Unsupported audio format: " +
                e.getMessage() +
                "\nMake sure the required audio SPI libraries are on the classpath.";
            logger.error(errorMsg, e);
            throw new IOException(errorMsg, e);
        } catch (IOException e) {
            logger.error("I/O error during audio decoding", e);
            throw e;
        } catch (Exception e) {
            logger.error("Unexpected error during audio decoding", e);
            throw new IOException("Unexpected error: " + e.getMessage(), e);
        }

        return chunks;
    }

    /**
     * Calculate RMS volume from PCM data
     */
    public static double calculateRms(byte[] pcmData) {
        ByteBuffer buffer = ByteBuffer.wrap(pcmData);
        buffer.order(ByteOrder.LITTLE_ENDIAN);

        double sumSquares = 0;
        int sampleCount = 0;

        while (buffer.remaining() >= 2) {
            short sample = buffer.getShort();
            double normalized = sample / 32768.0; // Normalize to -1.0 to 1.0
            sumSquares += normalized * normalized;
            sampleCount++;
        }

        return sampleCount > 0 ? Math.sqrt(sumSquares / sampleCount) : 0;
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
     * Progress callback interface
     */
    public interface ProgressCallback {
        void onProgress(double progress);
    }
}
