package com.sleepy.recorder.core;

/**
 * Audio configuration for Opus encoding
 */
public class AudioConfig {
    // Audio format
    public static final int SAMPLE_RATE = 48000; // Hz
    public static final int CHANNELS = 1; // Mono
    public static final int BITS_PER_SAMPLE = 16;

    // Opus configuration
    public static final int BITRATE = 256000; // 256 kbps
    public static final int FRAME_SIZE_MS = 20; // 20ms frames (standard for Opus)
    public static final int FRAME_SIZE_SAMPLES = (SAMPLE_RATE * FRAME_SIZE_MS) / 1000; // 960 samples

    // Application type for Opus
    public static final int APPLICATION = 2049; // OPUS_APPLICATION_AUDIO (Concentus constant)

    // Buffer sizes
    public static final int MAX_PACKET_SIZE = 4000; // Max Opus packet size

    /**
     * Available bitrate options for user configuration
     */
    public static final int[] AVAILABLE_BITRATES = {
        64000,   // 64 kbps
        96000,   // 96 kbps
        128000,  // 128 kbps
        192000,  // 192 kbps
        256000,  // 256 kbps (default)
        320000,  // 320 kbps
        510000   // 510 kbps (max)
    };

    private AudioConfig() {
        // Utility class
    }
}
