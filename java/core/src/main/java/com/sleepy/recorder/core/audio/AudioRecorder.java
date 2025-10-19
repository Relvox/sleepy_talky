package com.sleepy.recorder.core.audio;

import java.io.File;
import javax.sound.sampled.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Records audio from microphone and saves to OGG Opus format.
 * Delegates to OggOpusStreamingRecorder for actual encoding/streaming.
 */
public class AudioRecorder {

    private static final Logger logger = LoggerFactory.getLogger(
        AudioRecorder.class
    );

    private OggOpusStreamingRecorder opusRecorder;
    private RecordingCallback callback;

    public AudioRecorder() {
        this.opusRecorder = new OggOpusStreamingRecorder();
    }

    /**
     * Start recording to an OGG Opus file
     */
    public void startRecording(File outputFile, RecordingCallback callback)
        throws LineUnavailableException {
        logger.info("=== Starting audio recording ===");
        logger.info("Format: OGG Opus");
        logger.info("Output file: {}", outputFile.getAbsolutePath());

        this.callback = callback;

        // Delegate to Opus recorder with callback wrapper
        opusRecorder.startRecording(
            outputFile,
            new OggOpusStreamingRecorder.RecordingCallback() {
                @Override
                public void onAudioData(byte[] data, int length) {
                    if (callback != null) {
                        callback.onAudioData(data, length);
                    }
                }

                @Override
                public void onRecordingComplete(File file) {
                    if (callback != null) {
                        callback.onRecordingComplete(file);
                    }
                }

                @Override
                public void onError(Exception e) {
                    if (callback != null) {
                        callback.onError(e);
                    }
                }
            }
        );
    }

    /**
     * Stop recording
     */
    public void stopRecording() {
        opusRecorder.stopRecording();
    }

    /**
     * Check if currently recording
     */
    public boolean isRecording() {
        return opusRecorder.isRecording();
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
