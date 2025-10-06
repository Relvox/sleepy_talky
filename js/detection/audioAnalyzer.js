// Unified audio analysis for detecting noise events
// Process audio in chunks for efficiency (no need to simulate live playback)

// Configurable detection parameters
const BASELINE_PERCENTILE = 0.5; // Use 50th percentile (median) as baseline
const NOISE_THRESHOLD_MULTIPLIER = 2.5; // Noise is 2.5x baseline (~8dB louder)
const EVENT_PRE_BUFFER_MS = 2000; // Include 2s before event
const EVENT_POST_BUFFER_MS = 2000; // Include 2s after event
const MIN_EVENT_GAP_MS = 1000; // Merge events within 1s
const SAMPLE_INTERVAL_MS = 50; // Calculate volume every 50ms
const CHUNK_DURATION_MS = 30 * 60 * 1000; // Process in 30-minute chunks

export class AudioAnalyzer {
  constructor() {
    this.audioContext = null;
  }

  async analyzeAudio(audioBlob, onProgress, onStatusUpdate) {
    console.log("[AudioAnalyzer] Starting analysis...");
    console.log(
      `[AudioAnalyzer] Blob size: ${(audioBlob.size / 1024 / 1024).toFixed(2)} MB`,
    );

    // Create audio context for decoding
    if (onStatusUpdate) onStatusUpdate("Creating audio context...");
    this.audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    console.log("[AudioAnalyzer] Audio context created");

    // Decode audio data
    if (onStatusUpdate) onStatusUpdate("Decoding audio file...");
    console.log("[AudioAnalyzer] Decoding audio buffer...");
    const arrayBuffer = await audioBlob.arrayBuffer();
    console.log(
      `[AudioAnalyzer] ArrayBuffer loaded: ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`,
    );

    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

    const duration = audioBuffer.duration * 1000; // Convert to ms
    const sampleRate = audioBuffer.sampleRate;
    const channelData = audioBuffer.getChannelData(0); // Use first channel

    console.log(
      `[AudioAnalyzer] Audio decoded: ${(duration / 1000).toFixed(1)}s at ${sampleRate}Hz`,
    );
    console.log(`[AudioAnalyzer] Channel data samples: ${channelData.length}`);

    // Calculate volume samples
    if (onStatusUpdate) onStatusUpdate("Calculating volume levels...");
    console.log("[AudioAnalyzer] Calculating volume samples...");
    const volumeSamples = this.calculateVolumeSamples(
      channelData,
      sampleRate,
      duration,
      onProgress,
      onStatusUpdate,
    );
    console.log(
      `[AudioAnalyzer] Generated ${volumeSamples.length} volume samples`,
    );

    // Detect noise events using chunk-based approach
    if (onStatusUpdate) onStatusUpdate("Detecting noise events...");
    console.log("[AudioAnalyzer] Detecting noise events...");
    const events = this.detectNoiseEvents(
      volumeSamples,
      duration,
      onStatusUpdate,
    );
    console.log(`[AudioAnalyzer] Found ${events.length} noise event(s)`);

    // Calculate final baseline
    if (onStatusUpdate) onStatusUpdate("Calculating baseline...");
    const baseline = this.calculateBaseline(volumeSamples);
    console.log(`[AudioAnalyzer] Final baseline: ${baseline.toFixed(1)} dB`);

    if (onStatusUpdate) onStatusUpdate("Analysis complete!");
    return { events, baseline, duration };
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

    // Split into chunks for processing
    const chunkSizeInSamples = Math.floor(
      CHUNK_DURATION_MS / SAMPLE_INTERVAL_MS,
    );
    const numChunks = Math.ceil(volumeSamples.length / chunkSizeInSamples);

    console.log(
      `[AudioAnalyzer] Processing ${numChunks} chunk(s) of ~${CHUNK_DURATION_MS / 60000} minutes each`,
    );

    for (let chunkIdx = 0; chunkIdx < numChunks; chunkIdx++) {
      if (onStatusUpdate) {
        onStatusUpdate(`Processing chunk ${chunkIdx + 1}/${numChunks}...`);
      }
      const chunkStart = chunkIdx * chunkSizeInSamples;
      const chunkEnd = Math.min(
        (chunkIdx + 1) * chunkSizeInSamples,
        volumeSamples.length,
      );
      const chunkSamples = volumeSamples.slice(chunkStart, chunkEnd);

      const chunkStartTime = chunkSamples[0].time;
      const chunkEndTime = chunkSamples[chunkSamples.length - 1].time;
      console.log(
        `[AudioAnalyzer] Processing chunk ${chunkIdx + 1}/${numChunks}: ` +
          `${(chunkStartTime / 1000).toFixed(1)}s - ${(chunkEndTime / 1000).toFixed(1)}s`,
      );

      // Calculate baseline for this chunk
      const baseline = this.calculateBaseline(chunkSamples);
      const thresholdDb = 20 * Math.log10(NOISE_THRESHOLD_MULTIPLIER);
      const threshold = baseline + thresholdDb;

      console.log(
        `[AudioAnalyzer] Chunk ${chunkIdx + 1} baseline: ${baseline.toFixed(1)} dB, ` +
          `threshold: ${threshold.toFixed(1)} dB`,
      );

      // Detect events in this chunk
      let chunkEventsCount = 0;

      for (const sample of chunkSamples) {
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
              chunkEventsCount++;
            }

            currentEvent = null;
          }
        }
      }

      console.log(
        `[AudioAnalyzer] Chunk ${chunkIdx + 1} completed: ${chunkEventsCount} event(s) found`,
      );
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
