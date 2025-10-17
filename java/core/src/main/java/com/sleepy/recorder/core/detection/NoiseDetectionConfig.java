package com.sleepy.recorder.core.detection;

/**
 * Configuration for noise event detection algorithm
 */
public class NoiseDetectionConfig {
    // Baseline calculation
    public static final double BASELINE_PERCENTILE = 0.5; // 50th percentile (median)

    // Threshold for noise detection
    public static final double NOISE_THRESHOLD_MULTIPLIER = 2.5; // 2.5x louder = ~8dB above baseline

    // Event buffering
    public static final int EVENT_PRE_BUFFER_MS = 2000;  // 2 seconds before event
    public static final int EVENT_POST_BUFFER_MS = 2000; // 2 seconds after event

    // Event merging
    public static final int MIN_EVENT_GAP_MS = 1000; // Merge events within 1 second

    // Sampling
    public static final int SAMPLE_INTERVAL_MS = 50; // Calculate volume every 50ms

    // Chunked processing (to avoid memory issues with large files)
    public static final long CHUNK_DURATION_MS = 5 * 60 * 1000; // 5 minutes
    public static final long CHUNK_MAX_SIZE_BYTES = 30 * 1024 * 1024; // 30 MiB

    private NoiseDetectionConfig() {
        // Utility class
    }
}
