package com.sleepy.recorder.android;

import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import com.sleepy.recorder.core.AudioConfig;
import com.sleepy.recorder.core.codec.OggOpusWriter;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import org.concentus.OpusApplication;
import org.concentus.OpusEncoder;
import org.concentus.OpusException;
import org.concentus.OpusSignal;

/**
 * Android-specific audio recorder using AudioRecord API
 * Records to Ogg Opus format using Concentus encoder
 */
public class AndroidAudioRecorder {

    private static final int OPUS_FRAME_SIZE = 960; // 20ms at 48kHz
    private static final int MAX_PACKET_SIZE = 4000;

    private AudioRecord audioRecord;
    private Thread recordingThread;
    private volatile boolean recording;
    private File outputFile;
    private RecordingCallback callback;

    public AndroidAudioRecorder() {}

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
        bufferSize = Math.max(bufferSize, OPUS_FRAME_SIZE * 2);

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
     * Recording loop - encodes PCM to Opus and streams to Ogg file
     */
    private void recordLoop() {
        FileOutputStream fos = null;
        OggOpusWriter oggWriter = null;
        OpusEncoder encoder = null;

        try {
            // Create Opus encoder
            encoder = new OpusEncoder(
                AudioConfig.SAMPLE_RATE,
                AudioConfig.CHANNELS,
                OpusApplication.OPUS_APPLICATION_AUDIO
            );
            encoder.setBitrate(64000); // 64kbps for mono
            encoder.setComplexity(5); // Medium complexity
            encoder.setSignalType(OpusSignal.OPUS_SIGNAL_MUSIC);

            // Create Ogg Opus writer
            fos = new FileOutputStream(outputFile);
            oggWriter = new OggOpusWriter(
                fos,
                AudioConfig.SAMPLE_RATE,
                AudioConfig.CHANNELS
            );
            oggWriter.writeHeaders();

            // Encoding loop
            byte[] frameBuffer = new byte[OPUS_FRAME_SIZE * 2]; // 16-bit PCM
            short[] pcmSamples = new short[OPUS_FRAME_SIZE];
            byte[] encodedBuffer = new byte[MAX_PACKET_SIZE];

            while (recording) {
                // Read one Opus frame (20ms)
                int bytesRead = 0;
                while (bytesRead < frameBuffer.length && recording) {
                    int read = audioRecord.read(
                        frameBuffer,
                        bytesRead,
                        frameBuffer.length - bytesRead
                    );
                    if (read > 0) {
                        bytesRead += read;
                    } else if (read < 0) {
                        throw new IOException(
                            "AudioRecord read error: " + read
                        );
                    }
                }

                if (!recording) {
                    break;
                }

                // Convert bytes to shorts for Opus encoder (little-endian)
                for (int i = 0; i < OPUS_FRAME_SIZE; i++) {
                    int byteIndex = i * 2;
                    pcmSamples[i] = (short) ((frameBuffer[byteIndex] & 0xFF) |
                        ((frameBuffer[byteIndex + 1] & 0xFF) << 8));
                }

                // Encode PCM to Opus
                int encodedBytes = encoder.encode(
                    pcmSamples,
                    0,
                    OPUS_FRAME_SIZE,
                    encodedBuffer,
                    0,
                    MAX_PACKET_SIZE
                );

                if (encodedBytes > 0) {
                    // Create packet and write to Ogg
                    byte[] packet = new byte[encodedBytes];
                    System.arraycopy(encodedBuffer, 0, packet, 0, encodedBytes);
                    oggWriter.writeAudioPacket(packet, OPUS_FRAME_SIZE);

                    // Notify callback with original PCM data
                    if (callback != null) {
                        callback.onAudioData(frameBuffer, frameBuffer.length);
                    }
                }
            }
        } catch (IOException | OpusException e) {
            if (callback != null) {
                callback.onError(e);
            }
        } finally {
            // Close resources
            try {
                if (oggWriter != null) {
                    oggWriter.finalizeStream();
                    oggWriter.close();
                }
            } catch (IOException e) {
                // Ignore
            }

            try {
                if (fos != null) {
                    fos.close();
                }
            } catch (IOException e) {
                // Ignore
            }

            if (callback != null) {
                callback.onRecordingComplete(outputFile);
            }
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
