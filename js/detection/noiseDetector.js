// Configurable parameters
const BASELINE_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
const BASELINE_PERCENTILE = 0.5; // Use 50th percentile as baseline
const NOISE_THRESHOLD_MULTIPLIER = 2.5; // Noise is 2.5x baseline
const EVENT_PRE_BUFFER_MS = 2000; // 2 seconds before
const EVENT_POST_BUFFER_MS = 2000; // 2 seconds after
const SAMPLE_INTERVAL_MS = 50; // Sample volume every 50ms (faster for live recording)
const MIN_EVENT_GAP_MS = 1000; // Merge events within 1 second

export class NoiseDetector {
  constructor() {
    this.volumeSamples = [];
    this.baselineValue = null;
    this.lastBaselineUpdate = null;
    this.events = [];
    this.currentEvent = null;
    this.recordingStartTime = null;
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

    const avgVolume =
      recentSamples.reduce((a, b) => a + b, 0) / recentSamples.length;
    const minVolume = Math.min(...recentSamples);
    const maxVolume = Math.max(...recentSamples);
    console.log(
      `[NoiseDetector] Baseline updated: ${this.baselineValue.toFixed(1)} dB | Range: ${minVolume.toFixed(1)} to ${maxVolume.toFixed(1)} dB | Avg: ${avgVolume.toFixed(1)} dB | Samples: ${recentSamples.length}`,
    );
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

    this.currentEvent = null;
  }

  getEvents() {
    return this.events;
  }

  getBaseline() {
    return this.baselineValue;
  }
}
