// Constants for UI manager
const FEEDBACK_DISPLAY_DURATION_MS = 3000;
const TIME_DISPLAY_PADDING = 2;
const TIME_PAD_CHAR = "0";

export class UIManager {
  constructor(elements) {
    this.elements = elements;
  }

  showFeedback(message) {
    this.elements.feedback.textContent = message;
    this.elements.feedback.classList.add("show");
    setTimeout(
      () => this.elements.feedback.classList.remove("show"),
      FEEDBACK_DISPLAY_DURATION_MS,
    );
  }

  updateStatus(status, className) {
    this.elements.status.textContent = status;
    this.elements.status.className = className;
  }

  updateTimer(elapsed) {
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    this.elements.timer.textContent = `${String(minutes).padStart(TIME_DISPLAY_PADDING, TIME_PAD_CHAR)}:${String(seconds).padStart(TIME_DISPLAY_PADDING, TIME_PAD_CHAR)}`;
  }

  clearTimer() {
    this.elements.timer.textContent = "";
  }

  updateStateInfo(
    recorderState,
    streamActive,
    chunksCount,
    totalBytes,
    hasAudio,
  ) {
    this.elements.recorderState.textContent = `Recorder: ${recorderState}`;
    this.elements.audioState.textContent = `Audio stream: ${streamActive ? "Active" : "Inactive"}`;
    this.elements.dataState.textContent = `Recorded data: ${chunksCount} chunk(s), ${totalBytes} bytes`;
    this.elements.blobState.textContent = `Audio file: ${hasAudio ? "Ready for download" : "Not ready"}`;
  }

  setButtonStates(states) {
    if (states.record !== undefined)
      this.elements.recordBtn.disabled = !states.record;
    if (states.stop !== undefined)
      this.elements.stopBtn.disabled = !states.stop;
    if (states.play !== undefined)
      this.elements.playBtn.disabled = !states.play;
    if (states.download !== undefined)
      this.elements.downloadBtn.disabled = !states.download;
  }

  setPlayButtonText(isPlaying) {
    this.elements.playBtn.textContent = isPlaying ? "⏸️" : "▶️";
  }

  toggleVisualizerDisplay(mode) {
    if (mode === "bands") {
      this.elements.frequencyBandsView.style.display = "block";
      this.elements.spectralView.style.display = "none";
      this.elements.toggleDisplayBtn.textContent = "Switch to Waveform/FFT";
    } else {
      this.elements.frequencyBandsView.style.display = "none";
      this.elements.spectralView.style.display = "block";
      this.elements.toggleDisplayBtn.textContent = "Switch to Frequency Bands";
    }
  }
}
