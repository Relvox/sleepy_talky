package com.sleepy.recorder.android;

import com.sleepy.recorder.core.detection.NoiseEvent;
import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Android-compatible audio analyzer
 * Detects noise events in recorded audio files
 */
public class AndroidAudioAnalyzer {

    // Detection parameters (same as desktop version)
    private static final double BASELINE_PERCENTILE = 0.5; // 50th percentile
    private static final double NOISE_THRESHOLD_MULTIPLIER = 2.5; // 2.5x baseline = ~8dB louder
    private static final long EVENT_PRE_BUFFER_MS = 2000; // 2 seconds before
    private static final long EVENT_POST_BUFFER_MS = 2000; // 2 seconds after
    private static final long MIN_EVENT_GAP_MS = 1000; // Merge events within 1 second
    private static final long SAMPLE_INTERVAL_MS = 50; // Calculate volume every 50ms

    /**
     * Analyze audio file for noise events
     */
    public List<NoiseEvent> analyzeFile(
        File audioFile,
        AndroidAudioDecoder.ProgressCallback progressCallback
    ) throws IOException {
        // Decode audio to PCM chunks
        List<AndroidAudioDecoder.PcmChunk> chunks = AndroidAudioDecoder.decode(
            audioFile,
            progressCallback
        );

        if (chunks.isEmpty()) {
            return new ArrayList<>();
        }

        // Calculate volume samples
        List<VolumeSample> volumeSamples = calculateVolumeSamples(chunks);

        // Calculate baseline from all samples
        double baseline = calculateBaseline(volumeSamples);
        double threshold = baseline * NOISE_THRESHOLD_MULTIPLIER;

        // Detect events above threshold
        List<NoiseEvent> events = detectEvents(
            volumeSamples,
            baseline,
            threshold
        );

        // Merge nearby events
        events = mergeNearbyEvents(events);

        return events;
    }

    /**
     * Calculate volume samples at regular intervals
     */
    private List<VolumeSample> calculateVolumeSamples(
        List<AndroidAudioDecoder.PcmChunk> chunks
    ) {
        List<VolumeSample> samples = new ArrayList<>();

        for (AndroidAudioDecoder.PcmChunk chunk : chunks) {
            double rms = AndroidAudioDecoder.calculateRms(chunk.pcmData);
            samples.add(new VolumeSample(chunk.timeMs, rms));
        }

        return samples;
    }

    /**
     * Calculate baseline volume (median)
     */
    private double calculateBaseline(List<VolumeSample> samples) {
        if (samples.isEmpty()) {
            return 0;
        }

        List<Double> volumes = new ArrayList<>();
        for (VolumeSample sample : samples) {
            volumes.add(sample.volume);
        }

        Collections.sort(volumes);

        int index = (int) (volumes.size() * BASELINE_PERCENTILE);
        return volumes.get(Math.min(index, volumes.size() - 1));
    }

    /**
     * Detect noise events above threshold
     */
    private List<NoiseEvent> detectEvents(
        List<VolumeSample> samples,
        double baseline,
        double threshold
    ) {
        List<NoiseEvent> events = new ArrayList<>();

        Long eventStart = null;
        double eventPeak = 0;

        for (VolumeSample sample : samples) {
            if (sample.volume > threshold) {
                // Start new event or continue existing
                if (eventStart == null) {
                    eventStart = sample.timeMs;
                    eventPeak = sample.volume;
                } else {
                    eventPeak = Math.max(eventPeak, sample.volume);
                }
            } else {
                // End current event
                if (eventStart != null) {
                    long eventEnd = sample.timeMs;
                    events.add(new NoiseEvent(eventStart, eventEnd, eventPeak));
                    eventStart = null;
                    eventPeak = 0;
                }
            }
        }

        // Close final event if still open
        if (eventStart != null && !samples.isEmpty()) {
            long eventEnd = samples.get(samples.size() - 1).timeMs;
            events.add(new NoiseEvent(eventStart, eventEnd, eventPeak));
        }

        return events;
    }

    /**
     * Merge events that are close together
     */
    private List<NoiseEvent> mergeNearbyEvents(List<NoiseEvent> events) {
        if (events.isEmpty()) {
            return events;
        }

        List<NoiseEvent> merged = new ArrayList<>();
        NoiseEvent current = events.get(0);

        for (int i = 1; i < events.size(); i++) {
            NoiseEvent next = events.get(i);

            // Check if events overlap or are close
            if (
                next.getStartTimeMs() - current.getEndTimeMs() <=
                MIN_EVENT_GAP_MS
            ) {
                // Merge events
                current = new NoiseEvent(
                    current.getStartTimeMs(),
                    next.getEndTimeMs(),
                    Math.max(current.getPeakVolume(), next.getPeakVolume())
                );
            } else {
                // Save current and move to next
                merged.add(current);
                current = next;
            }
        }

        merged.add(current);
        return merged;
    }

    /**
     * Internal class for volume sample
     */
    private static class VolumeSample {

        final long timeMs;
        final double volume;

        VolumeSample(long timeMs, double volume) {
            this.timeMs = timeMs;
            this.volume = volume;
        }
    }
}
