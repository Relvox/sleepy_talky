package com.sleepy.recorder.android;

import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;

import com.sleepy.recorder.core.AudioConfig;
import com.sleepy.recorder.core.codec.OggOpusWriter;
import com.sleepy.recorder.core.codec.OpusEncoder;
import org.concentus.OpusException;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;

/**
 * Android-specific audio recorder using AudioRecord API
 */
public class AndroidAudioRecorder {
    private AudioRecord audioRecord;
    private Thread recordingThread;
    private volatile boolean recording;
    private File outputFile;
    private RecordingCallback callback;

    public AndroidAudioRecorder() {
    }

    /**
     * Start recording to a file
     */
    public void startRecording(File outputFile, RecordingCallback callback) {
        if (recording) {
            throw new IllegalStateException("Already recording");
        }

        this.outputFile = outputFile;
        this.callback = callback;

        // Calculate buffer size
        int bufferSize = AudioRecord.getMinBufferSize(
                AudioConfig.SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT
        );

        // Ensure buffer is at least one frame
        bufferSize = Math.max(bufferSize, AudioConfig.FRAME_SIZE_SAMPLES * 2);

        // Create AudioRecord
        audioRecord = new AudioRecord(
                MediaRecorder.AudioSource.MIC,
                AudioConfig.SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT,
                bufferSize
        );

        if (audioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
            throw new RuntimeException("Failed to initialize AudioRecord");
        }

        audioRecord.startRecording();
        recording = true;

        // Start recording thread
        recordingThread = new Thread(this::recordLoop);
        recordingThread.setName("AndroidAudioRecorder");
        recordingThread.start();
    }

    /**
     * Stop recording
     */
    public void stopRecording() {
        if (!recording) {
            return;
        }

        recording = false;

        try {
            if (recordingThread != null) {
                recordingThread.join(5000);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        if (audioRecord != null) {
            audioRecord.stop();
            audioRecord.release();
            audioRecord = null;
        }
    }

    /**
     * Check if currently recording
     */
    public boolean isRecording() {
        return recording;
    }

    /**
     * Recording loop
     */
    private void recordLoop() {
        try (FileOutputStream fos = new FileOutputStream(outputFile);
             OggOpusWriter oggWriter = new OggOpusWriter(fos);
             OpusEncoder encoder = new OpusEncoder()) {

            oggWriter.writeHeaders();

            byte[] buffer = new byte[AudioConfig.FRAME_SIZE_SAMPLES * 2]; // 16-bit samples

            while (recording) {
                int bytesRead = audioRecord.read(buffer, 0, buffer.length);

                if (bytesRead > 0) {
                    // Encode and write to file
                    byte[] packet = encodeFrame(encoder, buffer, bytesRead);
                    if (packet != null && packet.length > 0) {
                        oggWriter.writePacket(packet, packet.length);
                    }

                    // Notify callback
                    if (callback != null) {
                        callback.onAudioData(buffer, bytesRead);
                    }
                } else if (bytesRead < 0) {
                    // Error occurred
                    throw new IOException("AudioRecord read error: " + bytesRead);
                }
            }

            // Flush encoder
            encoder.flush(new java.io.ByteArrayOutputStream());

        } catch (IOException | OpusException e) {
            if (callback != null) {
                callback.onError(e);
            }
        }

        if (callback != null) {
            callback.onRecordingComplete(outputFile);
        }
    }

    /**
     * Encode a frame of audio
     */
    private byte[] encodeFrame(OpusEncoder encoder, byte[] pcmData, int length) throws OpusException, IOException {
        java.io.ByteArrayOutputStream packetStream = new java.io.ByteArrayOutputStream();
        encoder.encode(pcmData, 0, length, packetStream);
        return packetStream.toByteArray();
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
