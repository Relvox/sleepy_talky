package com.sleepy.recorder.core.audio;

import com.sleepy.recorder.core.AudioConfig;
import java.io.File;
import java.io.IOException;
import javax.sound.sampled.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Records audio from microphone and saves to WAV format
 */
public class AudioRecorder {

    private static final Logger logger = LoggerFactory.getLogger(
        AudioRecorder.class
    );

    private TargetDataLine microphone;
    private Thread recordingThread;
    private volatile boolean recording;
    private File outputFile;
    private RecordingCallback callback;

    public AudioRecorder() {}

    /**
     * Start recording to a file
     */
    public void startRecording(File outputFile, RecordingCallback callback)
        throws LineUnavailableException {
        if (recording) {
            throw new IllegalStateException("Already recording");
        }

        logger.info("=== Starting recording ===");
        logger.info("Output file: {}", outputFile.getAbsolutePath());

        this.outputFile = outputFile;
        this.callback = callback;

        // Open microphone
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
        recordingThread.setName("AudioRecorder");
        recordingThread.start();
    }

    /**
     * Stop recording
     */
    public void stopRecording() {
        if (!recording) {
            return;
        }

        logger.info("Stopping recording");
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
     * Recording loop - writes directly to WAV file
     */
    private void recordLoop() {
        AudioFormat format = new AudioFormat(
            AudioConfig.SAMPLE_RATE,
            AudioConfig.BITS_PER_SAMPLE,
            AudioConfig.CHANNELS,
            true,
            false
        );

        try {
            logger.info("Opening audio output stream for WAV file");

            // Create AudioInputStream from microphone
            AudioInputStream audioStream = new AudioInputStream(microphone);

            // Write to WAV file using AudioSystem
            AudioSystem.write(
                audioStream,
                AudioFileFormat.Type.WAVE,
                outputFile
            );

            logger.info(
                "Recording saved successfully: {} ({} bytes)",
                outputFile.getName(),
                outputFile.length()
            );
        } catch (IOException e) {
            logger.error("Recording error", e);
            if (callback != null) {
                callback.onError(e);
            }
        }

        if (callback != null) {
            callback.onRecordingComplete(outputFile);
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
