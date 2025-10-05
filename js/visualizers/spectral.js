// Constants for spectral visualization
const BACKGROUND_COLOR = "#1a1a1a";
const WAVEFORM_COLOR = "#00ff00";
const WAVEFORM_LINE_WIDTH = 2;
const WAVEFORM_NORMALIZATION = 128.0;
const FREQUENCY_BAR_WIDTH_MULTIPLIER = 2.5;
const FREQUENCY_BAR_SPACING = 1;
const FREQUENCY_NORMALIZATION = 255;
const HUE_RANGE = 240;
const HSL_SATURATION = 100;
const HSL_LIGHTNESS = 50;

export class SpectralVisualizer {
  constructor(waveformCanvas, frequencyCanvas) {
    this.waveformCanvas = waveformCanvas;
    this.frequencyCanvas = frequencyCanvas;
    this.waveformCtx = waveformCanvas.getContext("2d");
    this.frequencyCtx = frequencyCanvas.getContext("2d");
  }

  update(dataArray, waveformData, bufferLength) {
    this.drawWaveform(waveformData, bufferLength);
    this.drawFrequency(dataArray, bufferLength);
  }

  drawWaveform(waveformData, bufferLength) {
    this.waveformCtx.fillStyle = BACKGROUND_COLOR;
    this.waveformCtx.fillRect(
      0,
      0,
      this.waveformCanvas.width,
      this.waveformCanvas.height,
    );
    this.waveformCtx.lineWidth = WAVEFORM_LINE_WIDTH;
    this.waveformCtx.strokeStyle = WAVEFORM_COLOR;
    this.waveformCtx.beginPath();

    const sliceWidth = this.waveformCanvas.width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = waveformData[i] / WAVEFORM_NORMALIZATION;
      const y = (v * this.waveformCanvas.height) / 2;

      if (i === 0) {
        this.waveformCtx.moveTo(x, y);
      } else {
        this.waveformCtx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    this.waveformCtx.stroke();
  }

  drawFrequency(dataArray, bufferLength) {
    this.frequencyCtx.fillStyle = BACKGROUND_COLOR;
    this.frequencyCtx.fillRect(
      0,
      0,
      this.frequencyCanvas.width,
      this.frequencyCanvas.height,
    );

    const barWidth =
      (this.frequencyCanvas.width / bufferLength) *
      FREQUENCY_BAR_WIDTH_MULTIPLIER;
    let barHeight;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      barHeight =
        (dataArray[i] / FREQUENCY_NORMALIZATION) * this.frequencyCanvas.height;

      const hue = (i / bufferLength) * HUE_RANGE;
      this.frequencyCtx.fillStyle = `hsl(${hue}, ${HSL_SATURATION}%, ${HSL_LIGHTNESS}%)`;
      this.frequencyCtx.fillRect(
        x,
        this.frequencyCanvas.height - barHeight,
        barWidth,
        barHeight,
      );

      x += barWidth + FREQUENCY_BAR_SPACING;
    }
  }

  clear() {
    this.waveformCtx.fillStyle = BACKGROUND_COLOR;
    this.waveformCtx.fillRect(
      0,
      0,
      this.waveformCanvas.width,
      this.waveformCanvas.height,
    );
    this.frequencyCtx.fillStyle = BACKGROUND_COLOR;
    this.frequencyCtx.fillRect(
      0,
      0,
      this.frequencyCanvas.width,
      this.frequencyCanvas.height,
    );
  }
}
