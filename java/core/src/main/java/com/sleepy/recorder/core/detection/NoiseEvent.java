package com.sleepy.recorder.core.detection;

/**
 * Represents a detected noise event with start/end timestamps
 */
public class NoiseEvent {
    private final long startTimeMs;
    private final long endTimeMs;
    private final double peakVolume;

    public NoiseEvent(long startTimeMs, long endTimeMs, double peakVolume) {
        this.startTimeMs = startTimeMs;
        this.endTimeMs = endTimeMs;
        this.peakVolume = peakVolume;
    }

    public long getStartTimeMs() {
        return startTimeMs;
    }

    public long getEndTimeMs() {
        return endTimeMs;
    }

    public long getDurationMs() {
        return endTimeMs - startTimeMs;
    }

    public double getPeakVolume() {
        return peakVolume;
    }

    /**
     * Get playback start time with pre-buffer applied
     */
    public long getPlaybackStartMs() {
        return Math.max(0, startTimeMs - NoiseDetectionConfig.EVENT_PRE_BUFFER_MS);
    }

    /**
     * Get playback end time with post-buffer applied
     */
    public long getPlaybackEndMs() {
        return endTimeMs + NoiseDetectionConfig.EVENT_POST_BUFFER_MS;
    }

    @Override
    public String toString() {
        return String.format("NoiseEvent[%d-%d ms, duration=%d ms, peak=%.2f]",
                startTimeMs, endTimeMs, getDurationMs(), peakVolume);
    }
}
