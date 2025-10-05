// Offline audio analysis for uploaded files
const SAMPLE_INTERVAL_MS = 100;
const SAMPLE_RATE = 48000; // Common sample rate

export class OfflineAudioAnalyzer {
  constructor() {
    this.audioContext = null;
  }

  async analyzeFile(audioBlob, onProgress) {
    // Create audio context for decoding
    this.audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();

    // Decode audio data
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

    const duration = audioBuffer.duration * 1000; // Convert to ms
    const sampleRate = audioBuffer.sampleRate;
    const channelData = audioBuffer.getChannelData(0); // Use first channel

    // Calculate volume samples without playback
    const volumeSamples = [];
    const samplesPerInterval = Math.floor(
      (SAMPLE_INTERVAL_MS / 1000) * sampleRate,
    );
    const totalSamples = channelData.length;

    for (let i = 0; i < totalSamples; i += samplesPerInterval) {
      const endIndex = Math.min(i + samplesPerInterval, totalSamples);
      const chunk = channelData.slice(i, endIndex);

      // Calculate RMS for this chunk
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
      if (onProgress && i % (samplesPerInterval * 10) === 0) {
        onProgress((i / totalSamples) * 100);
      }
    }

    if (onProgress) {
      onProgress(100);
    }

    return { volumeSamples, duration };
  }

  async analyzeSamples(volumeSamples, duration, noiseDetector) {
    // Feed samples to noise detector
    noiseDetector.volumeSamples = volumeSamples;
    noiseDetector.recordingStartTime = 0;

    // Calculate baseline
    noiseDetector.updateBaseline();

    // Detect events
    volumeSamples.forEach((sample) => {
      noiseDetector.detectEvent(sample.time, sample.volume);
    });

    // Finalize any pending event
    if (noiseDetector.currentEvent) {
      noiseDetector.finalizeEvent();
    }

    return noiseDetector.getEvents();
  }
}
