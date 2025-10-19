package com.sleepy.recorder.core.audio;

import com.sleepy.recorder.core.AudioConfig;
import com.sleepy.recorder.core.codec.OggOpusWriter;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import javax.sound.sampled.*;
import org.concentus.OpusApplication;
import org.concentus.OpusEncoder;
import org.concentus.OpusException;
import org.concentus.OpusSignal;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Records audio from microphone and streams to OGG Opus format in real-time.
 * Designed for long recordings (8+ hours) with minimal memory usage.
 * Uses Concentus for Opus encoding and VorbisJava for OGG container writing.
 */
public class OggOpusStreamingRecorder {

    private static final Logger logger = LoggerFactory.getLogger(
        OggOpusStreamingRecorder.class
    );

    // Opus frame size: 20ms at 48kHz = 960 samples
    private static final int OPUS_FRAME_SIZE = 960;
    private static final int OPUS_FRAME_BYTES = OPUS_FRAME_SIZE * 2; // 16-bit PCM = 2 bytes per sample

    // Maximum compressed frame size (recommended by Opus spec)
    private static final int MAX_PACKET_SIZE = 4000;

    private TargetDataLine microphone;
    private Thread recordingThread;
    private volatile boolean recording;
    private File outputFile;
    private RecordingCallback callback;

    public OggOpusStreamingRecorder() {}

    /**
     * Start recording to an OGG Opus file
     */
    public void startRecording(File outputFile, RecordingCallback callback)
        throws LineUnavailableException {
        if (recording) {
            throw new IllegalStateException("Already recording");
        }

        logger.info("=== Starting OGG Opus streaming recording ===");
        logger.info("Output file: {}", outputFile.getAbsolutePath());

        this.outputFile = outputFile;
        this.callback = callback;

        // Open microphone with Opus-compatible format (48kHz mono 16-bit)
        AudioFormat format = new AudioFormat(
            AudioConfig.SAMPLE_RATE,
            AudioConfig.BITS_PER_SAMPLE,
            AudioConfig.CHANNELS,
            true, // signed
            false // little-endian
        );

        logger.info("Recording format: {}", format);

        DataLine.Info info = new DataLine.Info(TargetDataLine.class, format);
        if (!AudioSystem.isLineSupported(info)) {
            logger.error("Audio format not supported: {}", format);
            throw new LineUnavailableException("Audio format not supported");
        }

        microphone = (TargetDataLine) AudioSystem.getLine(info);
        microphone.open(format);
        microphone.start();

        logger.info("Microphone opened successfully");

        recording = true;

        // Start recording thread
        recordingThread = new Thread(this::recordLoop);
        recordingThread.setName("OggOpusRecorder");
        recordingThread.start();
    }

    /**
     * Stop recording
     */
    public void stopRecording() {
        if (!recording) {
            return;
        }

        logger.info("Stopping OGG Opus recording");
        recording = false;

        try {
            if (recordingThread != null) {
                recordingThread.join(5000);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        if (microphone != null) {
            microphone.stop();
            microphone.close();
            microphone = null;
        }

        logger.info("Recording stopped");
    }

    /**
     * Check if currently recording
     */
    public boolean isRecording() {
        return recording;
    }

    /**
     * Recording loop - encodes PCM to Opus and streams to OGG file
     */
    private void recordLoop() {
        FileOutputStream fileOut = null;
        OggOpusWriter opusWriter = null;
        OpusEncoder encoder = null;

        try {
            logger.info("Initializing Opus encoder");

            // Create Opus encoder
            encoder = new OpusEncoder(
                (int) AudioConfig.SAMPLE_RATE,
                AudioConfig.CHANNELS,
                OpusApplication.OPUS_APPLICATION_AUDIO
            );

            // Set encoder parameters for good quality
            encoder.setBitrate(64000); // 64kbps for mono speech/ambient audio
            encoder.setComplexity(5); // Medium complexity (0-10 scale)
            encoder.setSignalType(OpusSignal.OPUS_SIGNAL_MUSIC); // General audio

            logger.info("Opus encoder initialized: 48kHz, 1 channel, 64kbps");

            // Create OGG Opus file
            fileOut = new FileOutputStream(outputFile);
            opusWriter = new OggOpusWriter(
                fileOut,
                (int) AudioConfig.SAMPLE_RATE,
                AudioConfig.CHANNELS
            );

            // Write Ogg Opus headers
            opusWriter.writeHeaders();

            logger.info("OGG Opus file created");

            // Encoding loop
            byte[] frameBuffer = new byte[OPUS_FRAME_BYTES];
            byte[] encodedBuffer = new byte[MAX_PACKET_SIZE];
            long totalFrames = 0;
            long lastLogTime = System.currentTimeMillis();

            while (recording) {
                // Read one Opus frame (20ms = 960 samples = 1920 bytes for 16-bit mono)
                int bytesRead = 0;
                while (bytesRead < OPUS_FRAME_BYTES && recording) {
                    int read = microphone.read(
                        frameBuffer,
                        bytesRead,
                        OPUS_FRAME_BYTES - bytesRead
                    );
                    if (read > 0) {
                        bytesRead += read;
                    }
                }

                if (!recording) {
                    break;
                }

                // Convert byte array to short array for Opus encoder
                short[] pcmSamples = new short[OPUS_FRAME_SIZE];
                for (int i = 0; i < OPUS_FRAME_SIZE; i++) {
                    int byteIndex = i * 2;
                    // Little-endian 16-bit PCM
                    pcmSamples[i] = (short) ((frameBuffer[byteIndex] & 0xFF) |
                        ((frameBuffer[byteIndex + 1] & 0xFF) << 8));
                }

                // Encode PCM frame to Opus
                int encodedBytes = encoder.encode(
                    pcmSamples,
                    0,
                    OPUS_FRAME_SIZE,
                    encodedBuffer,
                    0,
                    MAX_PACKET_SIZE
                );

                if (encodedBytes > 0) {
                    // Create Opus packet
                    byte[] packet = new byte[encodedBytes];
                    System.arraycopy(encodedBuffer, 0, packet, 0, encodedBytes);

                    // Write Opus packet to OGG container
                    opusWriter.writeAudioPacket(packet, OPUS_FRAME_SIZE);

                    totalFrames++;

                    // Callback with original PCM data
                    if (callback != null) {
                        callback.onAudioData(frameBuffer, OPUS_FRAME_BYTES);
                    }

                    // Log progress every 10 seconds
                    long now = System.currentTimeMillis();
                    if (now - lastLogTime >= 10000) {
                        double seconds =
                            (totalFrames * OPUS_FRAME_SIZE) /
                            AudioConfig.SAMPLE_RATE;
                        logger.info(
                            "Recording: {:.1f} seconds ({} frames, {} bytes compressed)",
                            seconds,
                            totalFrames,
                            outputFile.length()
                        );
                        lastLogTime = now;
                    }
                }
            }

            double totalSeconds =
                (totalFrames * OPUS_FRAME_SIZE) / AudioConfig.SAMPLE_RATE;
            logger.info(
                "Recording complete: {:.1f} seconds ({} frames)",
                totalSeconds,
                totalFrames
            );
        } catch (OpusException e) {
            logger.error("Opus encoding error", e);
            if (callback != null) {
                callback.onError(e);
            }
        } catch (IOException e) {
            logger.error("File I/O error", e);
            if (callback != null) {
                callback.onError(e);
            }
        } finally {
            // Close resources
            try {
                if (opusWriter != null) {
                    opusWriter.finalizeStream();
                    opusWriter.close();
                    logger.info("OGG Opus file closed");
                }
            } catch (IOException e) {
                logger.error("Error closing OggOpusWriter", e);
            }

            try {
                if (fileOut != null) {
                    fileOut.close();
                }
            } catch (IOException e) {
                logger.error("Error closing output stream", e);
            }

            if (callback != null) {
                callback.onRecordingComplete(outputFile);
            }

            logger.info(
                "OGG Opus file saved: {} ({} bytes)",
                outputFile.getName(),
                outputFile.length()
            );
        }
    }

    /**
     * Callback interface for recording events
     */
    public interface RecordingCallback {
        void onAudioData(byte[] data, int length);
        void onRecordingComplete(File file);
        void onError(Exception e);
    }
}
