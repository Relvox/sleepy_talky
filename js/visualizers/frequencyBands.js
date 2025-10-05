// Constants for frequency band visualization
const HISTORY_LENGTH = 4000;
const SAMPLE_RATE_NYQUIST = 24000; // Assuming ~48kHz sample rate
const LOW_FREQ = 20;
const MID_FREQ = 250;
const HIGH_FREQ = 2000;
const BACKGROUND_COLOR = "#1a1a1a";
const LOW_BAND_COLOR = "#ff6b6b";
const MID_BAND_COLOR = "#4ecdc4";
const HIGH_BAND_COLOR = "#95e1d3";
const TEXT_COLOR = "#ffffff";
const FONT_STYLE = "12px monospace";
const LABEL_X_OFFSET = 10;
const LABEL_Y_OFFSET = 15;
const LINE_WIDTH = 2;
const CHART_BOTTOM_PADDING = 20;

export class FrequencyBandsVisualizer {
  constructor(lowCanvas, midCanvas, highCanvas) {
    this.lowCanvas = lowCanvas;
    this.midCanvas = midCanvas;
    this.highCanvas = highCanvas;
    this.lowCtx = lowCanvas.getContext("2d");
    this.midCtx = midCanvas.getContext("2d");
    this.highCtx = highCanvas.getContext("2d");

    this.amplitudeHistory = {
      low: [],
      mid: [],
      high: [],
    };
    this.historyLength = HISTORY_LENGTH;
  }

  update(dataArray, bufferLength) {
    // Frequency ranges (assuming sample rate ~48kHz, Nyquist ~24kHz)
    // Low: 20-250Hz, Mid: 250-2000Hz, High: 2000-20000Hz
    const binSize = SAMPLE_RATE_NYQUIST / bufferLength;
    const lowEnd = Math.floor(MID_FREQ / binSize);
    const midEnd = Math.floor(HIGH_FREQ / binSize);

    // Calculate average amplitude for each band
    let lowSum = 0,
      midSum = 0,
      highSum = 0;

    for (let i = 1; i < lowEnd; i++) lowSum += dataArray[i];
    for (let i = lowEnd; i < midEnd; i++) midSum += dataArray[i];
    for (let i = midEnd; i < bufferLength; i++) highSum += dataArray[i];

    const lowAvg = lowSum / lowEnd;
    const midAvg = midSum / (midEnd - lowEnd);
    const highAvg = highSum / (bufferLength - midEnd);

    // Add to history
    this.amplitudeHistory.low.push(lowAvg);
    this.amplitudeHistory.mid.push(midAvg);
    this.amplitudeHistory.high.push(highAvg);

    if (this.amplitudeHistory.low.length > this.historyLength) {
      this.amplitudeHistory.low.shift();
      this.amplitudeHistory.mid.shift();
      this.amplitudeHistory.high.shift();
    }

    // Draw each band
    this.drawTimeSeries(
      this.lowCtx,
      this.lowCanvas,
      this.amplitudeHistory.low,
      LOW_BAND_COLOR,
      `Low (${LOW_FREQ}-${MID_FREQ} Hz)`,
    );
    this.drawTimeSeries(
      this.midCtx,
      this.midCanvas,
      this.amplitudeHistory.mid,
      MID_BAND_COLOR,
      `Mid (${MID_FREQ}-${HIGH_FREQ} Hz)`,
    );
    this.drawTimeSeries(
      this.highCtx,
      this.highCanvas,
      this.amplitudeHistory.high,
      HIGH_BAND_COLOR,
      `High (${HIGH_FREQ}+ Hz)`,
    );
  }

  drawTimeSeries(ctx, canvas, data, color, label) {
    ctx.fillStyle = BACKGROUND_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw label
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = FONT_STYLE;
    ctx.fillText(label, LABEL_X_OFFSET, LABEL_Y_OFFSET);

    if (data.length < 2) return;

    ctx.strokeStyle = color;
    ctx.lineWidth = LINE_WIDTH;
    ctx.beginPath();

    const xStep = canvas.width / this.historyLength;
    const maxVal = Math.max(...data, 1);

    for (let i = 0; i < data.length; i++) {
      const x = i * xStep;
      const y =
        canvas.height -
        (data[i] / maxVal) * (canvas.height - CHART_BOTTOM_PADDING);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();
  }

  clear() {
    this.lowCtx.fillStyle = BACKGROUND_COLOR;
    this.lowCtx.fillRect(0, 0, this.lowCanvas.width, this.lowCanvas.height);
    this.midCtx.fillStyle = BACKGROUND_COLOR;
    this.midCtx.fillRect(0, 0, this.midCanvas.width, this.midCanvas.height);
    this.highCtx.fillStyle = BACKGROUND_COLOR;
    this.highCtx.fillRect(0, 0, this.highCanvas.width, this.highCanvas.height);

    this.amplitudeHistory.low = [];
    this.amplitudeHistory.mid = [];
    this.amplitudeHistory.high = [];
  }
}
