import { FrequencyBandsVisualizer } from "./frequencyBands.js";
import { SpectralVisualizer } from "./spectral.js";

// Constants for visualization manager
const WAVEFORM_NORMALIZATION_OFFSET = 128;
const WAVEFORM_NORMALIZATION_DIVISOR = 128;
const MIN_DB_THRESHOLD = -100;

export class VisualizationManager {
  constructor(canvases, volumeElement) {
    this.frequencyBands = new FrequencyBandsVisualizer(
      canvases.lowFreq,
      canvases.midFreq,
      canvases.highFreq,
    );
    this.spectral = new SpectralVisualizer(
      canvases.waveform,
      canvases.frequency,
    );

    this.volumeElement = volumeElement;
    this.analyser = null;
    this.animationId = null;
    this.displayMode = "bands";
  }

  setAnalyser(analyser) {
    this.analyser = analyser;
  }

  start() {
    if (!this.analyser) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const waveformData = new Uint8Array(bufferLength);

    const draw = () => {
      this.animationId = requestAnimationFrame(draw);

      // Get frequency data for FFT display
      this.analyser.getByteFrequencyData(dataArray);

      // Get waveform data for time-domain display
      this.analyser.getByteTimeDomainData(waveformData);

      // Calculate volume level (RMS)
      this.updateVolumeLevel(waveformData);

      if (this.displayMode === "bands") {
        this.frequencyBands.update(dataArray, bufferLength);
      } else {
        this.spectral.update(dataArray, waveformData, bufferLength);
      }
    };

    draw();
  }

  updateVolumeLevel(waveformData) {
    let sum = 0;
    for (let i = 0; i < waveformData.length; i++) {
      const normalized =
        (waveformData[i] - WAVEFORM_NORMALIZATION_OFFSET) /
        WAVEFORM_NORMALIZATION_DIVISOR;
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / waveformData.length);
    const db = 20 * Math.log10(rms);
    this.volumeElement.textContent = `Volume: ${db > MIN_DB_THRESHOLD ? db.toFixed(1) + " dB" : "-∞ dB"}`;
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    this.clear();
  }

  clear() {
    this.frequencyBands.clear();
    this.spectral.clear();
    this.volumeElement.textContent = "Volume: --";
  }

  setDisplayMode(mode) {
    this.displayMode = mode;
  }

  getDisplayMode() {
    return this.displayMode;
  }
}
