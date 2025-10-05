// Configurable parameters
const BASELINE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const BASELINE_PERCENTILE = 0.4; // Use 40th percentile as baseline
const NOISE_THRESHOLD_MULTIPLIER = 3.0; // Noise is 3x baseline
const EVENT_PRE_BUFFER_MS = 2000; // 2 seconds before
const EVENT_POST_BUFFER_MS = 2000; // 2 seconds after
const SAMPLE_INTERVAL_MS = 100; // Sample volume every 100ms
const MIN_EVENT_GAP_MS = 1000; // Merge events within 1 second

export class NoiseDetector {
  constructor() {
    this.volumeSamples = [];
    this.baselineValue = null;
    this.lastBaselineUpdate = null;
    this.events = []; // Array of {startTime, endTime, peakVolume}
    this.currentEvent = null;
    this.recordingStartTime = null;
    this.sampleInterval = null;
    this.analyser = null;

    // Callbacks
    this.onEventDetected = null;
    this.onEventEnded = null;
    this.onBaselineUpdated = null;
  }

  start(analyser, recordingStartTime) {
    this.analyser = analyser;
    this.recordingStartTime = recordingStartTime;
    this.volumeSamples = [];
    this.baselineValue = null;
    this.lastBaselineUpdate = Date.now();
    this.events = [];
    this.currentEvent = null;

    // Start sampling
    this.sampleInterval = setInterval(() => {
      this.sampleVolume();
    }, SAMPLE_INTERVAL_MS);
  }

  stop() {
    if (this.sampleInterval) {
      clearInterval(this.sampleInterval);
      this.sampleInterval = null;
    }

    // Finalize any ongoing event
    if (this.currentEvent) {
      this.finalizeEvent();
    }
  }

  sampleVolume() {
    if (!this.analyser) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const waveformData = new Uint8Array(bufferLength);
    this.analyser.getByteTimeDomainData(waveformData);

    // Calculate RMS volume
    let sum = 0;
    for (let i = 0; i < waveformData.length; i++) {
      const normalized = (waveformData[i] - 128) / 128;
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / waveformData.length);
    const db = 20 * Math.log10(rms);
    const volume = db > -100 ? db : -100;

    const now = Date.now();
    const elapsed = now - this.recordingStartTime;

    // Store sample
    this.volumeSamples.push({ time: elapsed, volume });

    // Update baseline periodically
    if (
      !this.lastBaselineUpdate ||
      now - this.lastBaselineUpdate >= BASELINE_INTERVAL_MS
    ) {
      this.updateBaseline();
      this.lastBaselineUpdate = now;
    }

    // Detect noise events
    if (this.baselineValue !== null) {
      this.detectEvent(elapsed, volume);
    }
  }

  updateBaseline() {
    if (this.volumeSamples.length === 0) return;

    // Calculate baseline using percentile of recent samples
    const recentSamples = this.volumeSamples
      .slice(-Math.floor(BASELINE_INTERVAL_MS / SAMPLE_INTERVAL_MS))
      .map((s) => s.volume)
      .sort((a, b) => a - b);

    const percentileIndex = Math.floor(
      recentSamples.length * BASELINE_PERCENTILE,
    );
    this.baselineValue = recentSamples[percentileIndex];

    console.log(
      `[NoiseDetector] Baseline updated: ${this.baselineValue.toFixed(1)} dB (from ${recentSamples.length} samples, ${BASELINE_PERCENTILE * 100}th percentile)`,
    );

    if (this.onBaselineUpdated) {
      this.onBaselineUpdated(this.baselineValue);
    }
  }

  detectEvent(currentTime, volume) {
    // Add threshold in dB (not multiply - dB is logarithmic)
    // For 2x louder, add ~6 dB (20 * log10(2) ≈ 6)
    const thresholdDb = 20 * Math.log10(NOISE_THRESHOLD_MULTIPLIER);
    const threshold = this.baselineValue + thresholdDb;
    const isNoise = volume > threshold;

    if (isNoise) {
      if (!this.currentEvent) {
        // Start new event (with pre-buffer)
        this.currentEvent = {
          startTime: Math.max(0, currentTime - EVENT_PRE_BUFFER_MS),
          endTime: currentTime,
          peakVolume: volume,
        };

        console.log(
          `[NoiseDetector] Event started at ${(currentTime / 1000).toFixed(1)}s - Volume: ${volume.toFixed(1)} dB > Threshold: ${threshold.toFixed(1)} dB`,
        );

        if (this.onEventDetected) {
          this.onEventDetected(this.currentEvent);
        }
      } else {
        // Extend current event
        this.currentEvent.endTime = currentTime;
        this.currentEvent.peakVolume = Math.max(
          this.currentEvent.peakVolume,
          volume,
        );
      }
    } else {
      // Check if we should finalize the event
      if (
        this.currentEvent &&
        currentTime - this.currentEvent.endTime >= EVENT_POST_BUFFER_MS
      ) {
        this.finalizeEvent();
      }
    }
  }

  finalizeEvent() {
    if (!this.currentEvent) return;

    // Add post-buffer
    this.currentEvent.endTime += EVENT_POST_BUFFER_MS;

    // Merge with previous event if close enough
    const lastEvent = this.events[this.events.length - 1];
    if (
      lastEvent &&
      this.currentEvent.startTime - lastEvent.endTime <= MIN_EVENT_GAP_MS
    ) {
      console.log(
        `[NoiseDetector] Merging event (gap: ${this.currentEvent.startTime - lastEvent.endTime}ms < ${MIN_EVENT_GAP_MS}ms)`,
      );
      lastEvent.endTime = this.currentEvent.endTime;
      lastEvent.peakVolume = Math.max(
        lastEvent.peakVolume,
        this.currentEvent.peakVolume,
      );
    } else {
      console.log(
        `[NoiseDetector] Event finalized: ${(this.currentEvent.startTime / 1000).toFixed(1)}s - ${(this.currentEvent.endTime / 1000).toFixed(1)}s (peak: ${this.currentEvent.peakVolume.toFixed(1)} dB)`,
      );
      this.events.push({ ...this.currentEvent });
    }

    if (this.onEventEnded) {
      this.onEventEnded(this.currentEvent);
    }

    this.currentEvent = null;
  }

  getEvents() {
    return this.events;
  }

  getBaseline() {
    return this.baselineValue;
  }

  getManifest() {
    return {
      recordingStartTime: this.recordingStartTime,
      baselineValue: this.baselineValue,
      events: this.events.map((e) => ({
        startTime: e.startTime,
        endTime: e.endTime,
        peakVolume: e.peakVolume,
        duration: e.endTime - e.startTime,
      })),
      config: {
        baselineIntervalMs: BASELINE_INTERVAL_MS,
        baselinePercentile: BASELINE_PERCENTILE,
        thresholdMultiplier: NOISE_THRESHOLD_MULTIPLIER,
        preBufferMs: EVENT_PRE_BUFFER_MS,
        postBufferMs: EVENT_POST_BUFFER_MS,
      },
    };
  }

  loadManifest(manifest) {
    this.recordingStartTime = manifest.recordingStartTime;
    this.baselineValue = manifest.baselineValue;
    this.events = manifest.events || [];
  }
}
