package com.sleepy.recorder.core.detection;

import com.sleepy.recorder.core.codec.UniversalAudioDecoder;
import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Analyzes audio files for noise events using chunked processing
 * Supports multiple formats: Ogg Opus, Ogg Vorbis, MP3, WAV, M4A
 */
public class AudioAnalyzer {

    private static final Logger logger = LoggerFactory.getLogger(
        AudioAnalyzer.class
    );

    /**
     * Analyze any supported audio file and detect noise events
     * @param audioFile The audio file to analyze
     * @param progressCallback Optional callback for progress updates (0.0 to 1.0)
     * @return List of detected noise events
     */
    public List<NoiseEvent> analyzeFile(
        File audioFile,
        ProgressCallback progressCallback
    ) throws IOException {
        logger.info("=== Starting audio analysis ===");
        logger.info("File: {}", audioFile.getAbsolutePath());

        List<VolumeSample> allSamples = new ArrayList<>();

        try {
            // Decode audio using universal decoder
            logger.info("Decoding audio file...");
            // Wrap the callback to match the UniversalAudioDecoder interface
            UniversalAudioDecoder.ProgressCallback decoderCallback = null;
            if (progressCallback != null) {
                decoderCallback = progressCallback::onProgress;
            }
            List<UniversalAudioDecoder.PcmChunk> chunks =
                UniversalAudioDecoder.decode(audioFile, decoderCallback);

            logger.info("Decoded {} PCM chunks", chunks.size());

            // Collect volume samples from PCM chunks
            logger.info("Collecting volume samples...");
            long lastSampleTimeMs = 0;

            for (UniversalAudioDecoder.PcmChunk chunk : chunks) {
                // Calculate RMS volume for this chunk
                double volume = UniversalAudioDecoder.calculateRms(
                    chunk.pcmData
                );

                // Sample at configured interval
                if (
                    chunk.timeMs - lastSampleTimeMs >=
                    NoiseDetectionConfig.SAMPLE_INTERVAL_MS
                ) {
                    allSamples.add(new VolumeSample(chunk.timeMs, volume));
                    lastSampleTimeMs = chunk.timeMs;
                }
            }

            logger.info("Collected {} volume samples", allSamples.size());

            // Detect events from samples
            logger.info("Detecting noise events...");
            List<NoiseEvent> events = detectEvents(allSamples);
            logger.info("Detected {} noise events", events.size());

            return events;
        } catch (Exception e) {
            logger.error("Error analyzing audio file", e);
            throw e;
        }
    }

    /**
     * Detect noise events from volume samples
     */
    private List<NoiseEvent> detectEvents(List<VolumeSample> samples) {
        if (samples.isEmpty()) {
            logger.warn("No volume samples to analyze");
            return Collections.emptyList();
        }

        // Calculate baseline (median volume)
        logger.debug("Calculating baseline volume...");
        double baseline = calculateBaseline(samples);
        double threshold =
            baseline * NoiseDetectionConfig.NOISE_THRESHOLD_MULTIPLIER;

        logger.info("Baseline volume: {}", baseline);
        logger.info(
            "Noise threshold: {} ({}x baseline)",
            threshold,
            NoiseDetectionConfig.NOISE_THRESHOLD_MULTIPLIER
        );

        // Find events above threshold
        List<NoiseEvent> rawEvents = new ArrayList<>();
        Long eventStart = null;
        double eventPeak = 0;

        for (VolumeSample sample : samples) {
            if (sample.volume > threshold) {
                if (eventStart == null) {
                    // Start new event
                    eventStart = sample.timeMs;
                    eventPeak = sample.volume;
                    logger.debug("Event started at {}ms", eventStart);
                } else {
                    // Continue event, update peak
                    eventPeak = Math.max(eventPeak, sample.volume);
                }
            } else if (eventStart != null) {
                // End event
                logger.debug(
                    "Event ended at {}ms, peak: {}",
                    sample.timeMs,
                    eventPeak
                );
                rawEvents.add(
                    new NoiseEvent(eventStart, sample.timeMs, eventPeak)
                );
                eventStart = null;
                eventPeak = 0;
            }
        }

        // Close final event if needed
        if (eventStart != null && !samples.isEmpty()) {
            long endTime = samples.get(samples.size() - 1).timeMs;
            logger.debug("Closing final event at {}ms", endTime);
            rawEvents.add(new NoiseEvent(eventStart, endTime, eventPeak));
        }

        logger.info("Found {} raw events before merging", rawEvents.size());

        // Merge nearby events
        List<NoiseEvent> mergedEvents = mergeEvents(rawEvents);
        logger.info("After merging: {} events", mergedEvents.size());

        return mergedEvents;
    }

    /**
     * Calculate baseline volume (median)
     */
    private double calculateBaseline(List<VolumeSample> samples) {
        List<Double> volumes = new ArrayList<>();
        for (VolumeSample sample : samples) {
            volumes.add(sample.volume);
        }
        Collections.sort(volumes);

        int index = (int) (volumes.size() *
            NoiseDetectionConfig.BASELINE_PERCENTILE);
        double baseline = volumes.get(Math.min(index, volumes.size() - 1));

        logger.debug(
            "Baseline calculated from {} samples at {}th percentile",
            volumes.size(),
            NoiseDetectionConfig.BASELINE_PERCENTILE * 100
        );

        return baseline;
    }

    /**
     * Merge events that are close together
     */
    private List<NoiseEvent> mergeEvents(List<NoiseEvent> events) {
        if (events.isEmpty()) {
            return events;
        }

        List<NoiseEvent> merged = new ArrayList<>();
        NoiseEvent current = events.get(0);
        int mergeCount = 0;

        for (int i = 1; i < events.size(); i++) {
            NoiseEvent next = events.get(i);

            if (
                next.getStartTimeMs() - current.getEndTimeMs() <=
                NoiseDetectionConfig.MIN_EVENT_GAP_MS
            ) {
                // Merge events
                logger.debug(
                    "Merging event at {}ms with event at {}ms (gap: {}ms)",
                    current.getStartTimeMs(),
                    next.getStartTimeMs(),
                    next.getStartTimeMs() - current.getEndTimeMs()
                );
                current = new NoiseEvent(
                    current.getStartTimeMs(),
                    next.getEndTimeMs(),
                    Math.max(current.getPeakVolume(), next.getPeakVolume())
                );
                mergeCount++;
            } else {
                // Keep current and move to next
                merged.add(current);
                current = next;
            }
        }

        merged.add(current);

        if (mergeCount > 0) {
            logger.info("Merged {} pairs of events", mergeCount);
        }

        return merged;
    }

    /**
     * Internal class for volume samples
     */
    private static class VolumeSample {

        final long timeMs;
        final double volume;

        VolumeSample(long timeMs, double volume) {
            this.timeMs = timeMs;
            this.volume = volume;
        }
    }

    /**
     * Callback interface for progress updates
     */
    public interface ProgressCallback {
        void onProgress(double progress);
    }
}
