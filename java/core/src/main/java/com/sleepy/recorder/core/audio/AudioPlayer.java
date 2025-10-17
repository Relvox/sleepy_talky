package com.sleepy.recorder.core.audio;

import com.sleepy.recorder.core.AudioConfig;
import com.sleepy.recorder.core.codec.UniversalAudioDecoder;
import java.io.File;
import java.util.List;
import javax.sound.sampled.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Plays back audio files in multiple formats
 * Supports: Ogg Opus, Ogg Vorbis, MP3, WAV
 */
public class AudioPlayer {

    private static final Logger logger = LoggerFactory.getLogger(
        AudioPlayer.class
    );

    private SourceDataLine speakers;
    private Thread playbackThread;
    private volatile boolean playing;
    private volatile boolean stopRequested;
    private File currentFile;
    private long startTimeMs;
    private long endTimeMs;

    public AudioPlayer() {}

    /**
     * Play an audio file
     */
    public void play(File file) throws LineUnavailableException {
        play(file, 0, -1);
    }

    /**
     * Play a segment of an audio file
     * @param file Audio file to play
     * @param startMs Start time in milliseconds
     * @param endMs End time in milliseconds (-1 for end of file)
     */
    public void play(File file, long startMs, long endMs)
        throws LineUnavailableException {
        logger.info("=== Starting playback ===");
        logger.info("File: {}", file.getAbsolutePath());
        logger.info(
            "Segment: {}ms to {}ms",
            startMs,
            endMs < 0 ? "end" : endMs
        );

        if (playing) {
            logger.info("Already playing, stopping current playback");
            stop();
        }

        this.currentFile = file;
        this.startTimeMs = startMs;
        this.endTimeMs = endMs;
        this.stopRequested = false;

        // Open speakers
        AudioFormat format = new AudioFormat(
            AudioConfig.SAMPLE_RATE,
            AudioConfig.BITS_PER_SAMPLE,
            AudioConfig.CHANNELS,
            true, // signed
            false // little-endian
        );

        DataLine.Info info = new DataLine.Info(SourceDataLine.class, format);
        if (!AudioSystem.isLineSupported(info)) {
            logger.error("Audio format not supported: {}", format);
            throw new LineUnavailableException("Audio format not supported");
        }

        speakers = (SourceDataLine) AudioSystem.getLine(info);
        speakers.open(format);
        speakers.start();
        logger.info("Audio line opened successfully");

        playing = true;

        // Start playback thread
        playbackThread = new Thread(this::playbackLoop);
        playbackThread.setName("AudioPlayer");
        playbackThread.start();
    }

    /**
     * Stop playback
     */
    public void stop() {
        if (!playing) {
            return;
        }

        logger.info("Stopping playback");
        stopRequested = true;

        try {
            if (playbackThread != null) {
                playbackThread.join(5000);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        if (speakers != null) {
            speakers.drain();
            speakers.stop();
            speakers.close();
            speakers = null;
        }

        playing = false;
        logger.info("Playback stopped");
    }

    /**
     * Check if currently playing
     */
    public boolean isPlaying() {
        return playing;
    }

    /**
     * Playback loop
     */
    private void playbackLoop() {
        try {
            logger.info("Decoding audio file for playback...");

            // Decode entire file using universal decoder
            List<UniversalAudioDecoder.PcmChunk> chunks =
                UniversalAudioDecoder.decode(
                    currentFile,
                    null // No progress callback during playback
                );

            logger.info(
                "Decoded {} PCM chunks, starting playback",
                chunks.size()
            );

            int chunksPlayed = 0;

            // Play chunks within the specified time range
            for (UniversalAudioDecoder.PcmChunk chunk : chunks) {
                if (stopRequested) {
                    logger.info(
                        "Playback stopped by user at {}ms",
                        chunk.timeMs
                    );
                    break;
                }

                // Calculate time range for this chunk
                long chunkDurationMs =
                    ((chunk.pcmData.length / 2) * 1000L) /
                    AudioConfig.SAMPLE_RATE;
                long chunkEndMs = chunk.timeMs + chunkDurationMs;

                // Check if we should play this chunk
                if (
                    chunkEndMs >= startTimeMs &&
                    (endTimeMs < 0 || chunk.timeMs <= endTimeMs)
                ) {
                    // Play chunk
                    speakers.write(chunk.pcmData, 0, chunk.pcmData.length);
                    chunksPlayed++;
                }

                // Check if we've reached the end time
                if (endTimeMs >= 0 && chunk.timeMs > endTimeMs) {
                    logger.info("Reached end time at {}ms", chunk.timeMs);
                    break;
                }
            }

            logger.info("Playback complete, played {} chunks", chunksPlayed);
        } catch (Exception e) {
            logger.error("Playback error", e);
            System.err.println("Playback error: " + e.getMessage());
        } finally {
            playing = false;
        }
    }
}
