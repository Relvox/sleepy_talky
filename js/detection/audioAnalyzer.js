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
    // Initialize FFmpeg
    if (onStatusUpdate) onStatusUpdate("Initializing FFmpeg...");
    await initFFmpeg((msg) => {
      if (onStatusUpdate) onStatusUpdate(msg);
    });

    // Create audio context for decoding
    if (onStatusUpdate) onStatusUpdate("Creating audio context...");
    this.audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();

    // Get total duration by decoding a small sample
    if (onStatusUpdate) onStatusUpdate("Detecting audio duration...");
    const sampleSize = Math.min(1024 * 1024, audioBlob.size); // 1MB sample
    const sampleBlob = audioBlob.slice(0, sampleSize);
    const sampleBuffer = await this.audioContext.decodeAudioData(
      await sampleBlob.arrayBuffer(),
    );

    // Estimate total duration based on sample
    const bytesPerSecond = sampleBlob.size / sampleBuffer.duration;
    const estimatedTotalDuration = (audioBlob.size / bytesPerSecond) * 1000; // ms

    // Calculate number of chunks needed
    const numChunks = Math.ceil(estimatedTotalDuration / CHUNK_DURATION_MS);
    const chunkDurationSeconds = CHUNK_DURATION_MS / 1000;

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

      // Extract this time range using FFmpeg
      const chunkBlob = await extractAudioChunk(
        audioBlob,
        startSeconds,
        durationSeconds,
      );

      if (onStatusUpdate) {
        onStatusUpdate(`Decoding chunk ${chunkIdx + 1}/${numChunks}...`);
      }

      // Decode the extracted WAV chunk
      const arrayBuffer = await chunkBlob.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      sampleRate = audioBuffer.sampleRate;
      const actualChunkDuration = audioBuffer.duration * 1000; // ms
      const channelData = audioBuffer.getChannelData(0);

      // Calculate volume samples for this chunk
      if (onStatusUpdate) {
        onStatusUpdate(`Analyzing chunk ${chunkIdx + 1}/${numChunks}...`);
      }

      const chunkVolumeSamples = this.calculateVolumeSamples(
        channelData,
        sampleRate,
        actualChunkDuration,
      );

      // Adjust timestamps to account for previous chunks
      const timeOffset = startSeconds * 1000; // Convert to ms
      chunkVolumeSamples.forEach((sample) => {
        sample.time += timeOffset;
      });

      allVolumeSamples = allVolumeSamples.concat(chunkVolumeSamples);
      totalDuration = Math.max(totalDuration, timeOffset + actualChunkDuration);
    }

    // Detect noise events
    if (onStatusUpdate) onStatusUpdate("Detecting noise events...");
    const events = this.detectNoiseEvents(
      allVolumeSamples,
      totalDuration,
      onStatusUpdate,
    );

    // Calculate final baseline
    if (onStatusUpdate) onStatusUpdate("Calculating baseline...");
    const baseline = this.calculateBaseline(allVolumeSamples);

    if (onStatusUpdate) onStatusUpdate("Analysis complete!");
    console.log(
      `[AudioAnalyzer] Analysis complete: ${events.length} events found, baseline: ${baseline.toFixed(1)} dB`,
    );
    return { events, baseline, duration: totalDuration };
  }

  calculateVolumeSamples(channelData, sampleRate, duration) {
    const volumeSamples = [];
    const samplesPerInterval = Math.floor(
      (SAMPLE_INTERVAL_MS / 1000) * sampleRate,
    );
    const totalSamples = channelData.length;

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
    }

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
            lastEvent.endTime = currentEvent.endTime;
            lastEvent.peakVolume = Math.max(
              lastEvent.peakVolume,
              currentEvent.peakVolume,
            );
          } else {
            events.push({ ...currentEvent });
          }

          currentEvent = null;
        }
      }
    }

    // Finalize any pending event
    if (currentEvent) {
      currentEvent.endTime += EVENT_POST_BUFFER_MS;
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
