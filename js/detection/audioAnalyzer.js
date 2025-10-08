// Unified audio analysis for detecting noise events
// Process audio in time-based chunks using FFmpeg for extraction

import { extractAudioChunk, initFFmpeg } from "../audio/ffmpegHelper.js";

// Configurable detection parameters
const BASELINE_PERCENTILE = 0.5; // Use 50th percentile (median) as baseline
const NOISE_THRESHOLD_MULTIPLIER = 2.5; // Noise is 2.5x baseline (~8dB louder)
const EVENT_PRE_BUFFER_MS = 2000; // Include 2s before event
const EVENT_POST_BUFFER_MS = 2000; // Include 2s after event
const MIN_EVENT_GAP_MS = 1000; // Merge events within 1s
const SAMPLE_INTERVAL_MS = 50; // Calculate volume every 50ms
const CHUNK_DURATION_MS = 1800000; // Process in 30-minute chunks (30 * 60 * 1000)

export class AudioAnalyzer {
  constructor() {
    this.audioContext = null;
  }

  async analyzeAudio(audioBlob, onProgress, onStatusUpdate) {
    console.log("[AudioAnalyzer] Starting analysis...");
    const blobSizeMB = audioBlob.size / 1024 / 1024;
    console.log(`[AudioAnalyzer] Blob size: ${blobSizeMB.toFixed(2)} MB`);

    // Initialize FFmpeg
    if (onStatusUpdate) onStatusUpdate("Initializing FFmpeg...");
    await initFFmpeg((msg) => {
      console.log(`[AudioAnalyzer] ${msg}`);
      if (onStatusUpdate) onStatusUpdate(msg);
    });

    // Create audio context for decoding
    if (onStatusUpdate) onStatusUpdate("Creating audio context...");
    this.audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    console.log("[AudioAnalyzer] Audio context created");

    // Get total duration by decoding a small sample
    if (onStatusUpdate) onStatusUpdate("Detecting audio duration...");
    console.log("[AudioAnalyzer] Detecting total duration...");
    const sampleSize = Math.min(1024 * 1024, audioBlob.size); // 1MB sample
    const sampleBlob = audioBlob.slice(0, sampleSize);
    const sampleBuffer = await this.audioContext.decodeAudioData(
      await sampleBlob.arrayBuffer(),
    );

    // Estimate total duration based on sample
    const bytesPerSecond = sampleBlob.size / sampleBuffer.duration;
    const estimatedTotalDuration = (audioBlob.size / bytesPerSecond) * 1000; // ms
    console.log(
      `[AudioAnalyzer] Estimated total duration: ${(estimatedTotalDuration / 1000 / 60).toFixed(1)} minutes`,
    );

    // Calculate number of chunks needed
    const numChunks = Math.ceil(estimatedTotalDuration / CHUNK_DURATION_MS);
    const chunkDurationSeconds = CHUNK_DURATION_MS / 1000;
    console.log(
      `[AudioAnalyzer] Processing ${numChunks} chunk(s) of ${chunkDurationSeconds / 60} minutes each`,
    );

    let allVolumeSamples = [];
    let totalDuration = 0;
    let sampleRate = 0;

    // Process each time-based chunk
    for (let chunkIdx = 0; chunkIdx < numChunks; chunkIdx++) {
      const startSeconds = chunkIdx * chunkDurationSeconds;
      const remainingSeconds = estimatedTotalDuration / 1000 - startSeconds;
      const durationSeconds = Math.min(chunkDurationSeconds, remainingSeconds);

      if (onStatusUpdate) {
        onStatusUpdate(
          `Extracting chunk ${chunkIdx + 1}/${numChunks} (${(startSeconds / 60).toFixed(1)}min)...`,
        );
      }
      console.log(
        `[AudioAnalyzer] Extracting chunk ${chunkIdx + 1}/${numChunks}: ${startSeconds}s + ${durationSeconds}s`,
      );

      // Extract this time range using FFmpeg
      const chunkBlob = await extractAudioChunk(
        audioBlob,
        startSeconds,
        durationSeconds,
        (msg) => {
          console.log(`[AudioAnalyzer] ${msg}`);
        },
      );

      if (onStatusUpdate) {
        onStatusUpdate(`Decoding chunk ${chunkIdx + 1}/${numChunks}...`);
      }
      console.log(
        `[AudioAnalyzer] Decoding chunk ${chunkIdx + 1}/${numChunks} (${(chunkBlob.size / 1024 / 1024).toFixed(2)} MB WAV)`,
      );

      // Decode the extracted WAV chunk
      const arrayBuffer = await chunkBlob.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      sampleRate = audioBuffer.sampleRate;
      const actualChunkDuration = audioBuffer.duration * 1000; // ms
      const channelData = audioBuffer.getChannelData(0);

      console.log(
        `[AudioAnalyzer] Chunk ${chunkIdx + 1} decoded: ${(actualChunkDuration / 1000).toFixed(1)}s at ${sampleRate}Hz`,
      );

      // Calculate volume samples for this chunk
      if (onStatusUpdate) {
        onStatusUpdate(`Analyzing chunk ${chunkIdx + 1}/${numChunks}...`);
      }

      const chunkVolumeSamples = this.calculateVolumeSamples(
        channelData,
        sampleRate,
        actualChunkDuration,
        null, // Don't report progress percentage
        null, // Don't send per-chunk status updates to avoid spam
      );

      // Adjust timestamps to account for previous chunks
      const timeOffset = startSeconds * 1000; // Convert to ms
      chunkVolumeSamples.forEach((sample) => {
        sample.time += timeOffset;
      });

      allVolumeSamples = allVolumeSamples.concat(chunkVolumeSamples);
      totalDuration = Math.max(totalDuration, timeOffset + actualChunkDuration);

      console.log(
        `[AudioAnalyzer] Chunk ${chunkIdx + 1} complete: ${chunkVolumeSamples.length} samples, total: ${allVolumeSamples.length}`,
      );
    }

    console.log(
      `[AudioAnalyzer] All chunks processed: ${(totalDuration / 1000 / 60).toFixed(1)} minutes total`,
    );
    console.log(
      `[AudioAnalyzer] Generated ${allVolumeSamples.length} volume samples`,
    );

    // Detect noise events
    if (onStatusUpdate) onStatusUpdate("Detecting noise events...");
    console.log("[AudioAnalyzer] Detecting noise events...");
    const events = this.detectNoiseEvents(
      allVolumeSamples,
      totalDuration,
      onStatusUpdate,
    );
    console.log(`[AudioAnalyzer] Found ${events.length} noise event(s)`);

    // Calculate final baseline
    if (onStatusUpdate) onStatusUpdate("Calculating baseline...");
    const baseline = this.calculateBaseline(allVolumeSamples);
    console.log(`[AudioAnalyzer] Final baseline: ${baseline.toFixed(1)} dB`);

    if (onStatusUpdate) onStatusUpdate("Analysis complete!");
    return { events, baseline, duration: totalDuration };
  }

  calculateVolumeSamples(
    channelData,
    sampleRate,
    duration,
    onProgress,
    onStatusUpdate,
  ) {
    const volumeSamples = [];
    const samplesPerInterval = Math.floor(
      (SAMPLE_INTERVAL_MS / 1000) * sampleRate,
    );
    const totalSamples = channelData.length;

    console.log(
      `[AudioAnalyzer] Volume calculation: ${totalSamples} samples, interval: ${samplesPerInterval}`,
    );

    let progressCounter = 0;
    const progressReportInterval = samplesPerInterval * 100; // Report every 100 intervals

    for (let i = 0; i < totalSamples; i += samplesPerInterval) {
      const endIndex = Math.min(i + samplesPerInterval, totalSamples);
      const chunk = channelData.slice(i, endIndex);

      // Calculate RMS (Root Mean Square) for this chunk
      let sum = 0;
      for (let j = 0; j < chunk.length; j++) {
        sum += chunk[j] * chunk[j];
      }
      const rms = Math.sqrt(sum / chunk.length);
      const db = rms > 0 ? 20 * Math.log10(rms) : -100;
      const volume = db > -100 ? db : -100;

      const time = (i / sampleRate) * 1000; // Convert to ms
      volumeSamples.push({ time, volume });

      // Report progress
      if (progressCounter % progressReportInterval === 0) {
        const progress = (i / totalSamples) * 100;

        if (onProgress) {
          onProgress(progress);
        }

        if (onStatusUpdate) {
          const minutes = Math.floor(
            (volumeSamples.length * SAMPLE_INTERVAL_MS) / 1000 / 60,
          );
          const totalMinutes = Math.floor(duration / 1000 / 60);
          onStatusUpdate(
            `Analyzing: ${minutes}/${totalMinutes} min (${progress.toFixed(0)}%)`,
          );
        }

        if (progressCounter % (progressReportInterval * 5) === 0) {
          console.log(
            `[AudioAnalyzer] Volume calculation progress: ${progress.toFixed(1)}%`,
          );
        }
      }
      progressCounter++;
    }

    if (onProgress) {
      onProgress(100);
    }

    console.log(
      `[AudioAnalyzer] Volume calculation complete: ${volumeSamples.length} samples generated`,
    );
    return volumeSamples;
  }

  detectNoiseEvents(volumeSamples, duration, onStatusUpdate) {
    const events = [];
    let currentEvent = null;

    if (onStatusUpdate) {
      onStatusUpdate("Detecting noise events...");
    }

    // Calculate baseline from all samples
    const baseline = this.calculateBaseline(volumeSamples);
    const thresholdDb = 20 * Math.log10(NOISE_THRESHOLD_MULTIPLIER);
    const threshold = baseline + thresholdDb;

    console.log(
      `[AudioAnalyzer] Baseline: ${baseline.toFixed(1)} dB, ` +
        `threshold: ${threshold.toFixed(1)} dB`,
    );

    let eventsCount = 0;

    for (const sample of volumeSamples) {
      const isNoise = sample.volume > threshold;

      if (isNoise) {
        if (!currentEvent) {
          // Start new event
          currentEvent = {
            startTime: Math.max(0, sample.time - EVENT_PRE_BUFFER_MS),
            endTime: sample.time,
            peakVolume: sample.volume,
          };
          console.log(
            `[AudioAnalyzer] Event started at ${(sample.time / 1000).toFixed(1)}s - ` +
              `Volume: ${sample.volume.toFixed(1)} dB > Threshold: ${threshold.toFixed(1)} dB`,
          );
        } else {
          // Extend current event
          currentEvent.endTime = sample.time;
          currentEvent.peakVolume = Math.max(
            currentEvent.peakVolume,
            sample.volume,
          );
        }
      } else if (currentEvent) {
        // Check if we should finalize the event
        if (sample.time - currentEvent.endTime >= EVENT_POST_BUFFER_MS) {
          // Finalize event
          currentEvent.endTime += EVENT_POST_BUFFER_MS;

          // Merge with previous event if close enough
          const lastEvent = events[events.length - 1];
          if (
            lastEvent &&
            currentEvent.startTime - lastEvent.endTime <= MIN_EVENT_GAP_MS
          ) {
            console.log(
              `[AudioAnalyzer] Merging event (gap: ${currentEvent.startTime - lastEvent.endTime}ms)`,
            );
            lastEvent.endTime = currentEvent.endTime;
            lastEvent.peakVolume = Math.max(
              lastEvent.peakVolume,
              currentEvent.peakVolume,
            );
          } else {
            console.log(
              `[AudioAnalyzer] Event finalized: ${(currentEvent.startTime / 1000).toFixed(1)}s - ` +
                `${(currentEvent.endTime / 1000).toFixed(1)}s (peak: ${currentEvent.peakVolume.toFixed(1)} dB)`,
            );
            events.push({ ...currentEvent });
            eventsCount++;
          }

          currentEvent = null;
        }
      }
    }

    // Finalize any pending event
    if (currentEvent) {
      currentEvent.endTime += EVENT_POST_BUFFER_MS;
      console.log(
        `[AudioAnalyzer] Final event finalized: ${(currentEvent.startTime / 1000).toFixed(1)}s - ` +
          `${(currentEvent.endTime / 1000).toFixed(1)}s (peak: ${currentEvent.peakVolume.toFixed(1)} dB)`,
      );
      events.push(currentEvent);
    }

    return events;
  }

  calculateBaseline(samples) {
    if (samples.length === 0) return -100;

    const volumes = samples.map((s) => s.volume).sort((a, b) => a - b);
    const percentileIndex = Math.floor(volumes.length * BASELINE_PERCENTILE);
    return volumes[percentileIndex];
  }
}
