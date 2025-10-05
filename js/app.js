import { AudioRecorder } from './audio/recorder.js';
import { AudioPlayer } from './audio/player.js';
import { VisualizationManager } from './visualizers/visualizationManager.js';
import { UIManager } from './ui/uiManager.js';

class SleepRecorderApp {
  constructor() {
    this.initializeUI();
    this.recorder = new AudioRecorder();
    this.player = new AudioPlayer(this.elements.audioPlayer);
    this.visualizer = new VisualizationManager(
      {
        waveform: this.elements.waveformCanvas,
        frequency: this.elements.frequencyCanvas,
        lowFreq: this.elements.lowFreqCanvas,
        midFreq: this.elements.midFreqCanvas,
        highFreq: this.elements.highFreqCanvas
      },
      this.elements.volumeLevel
    );
    this.ui = new UIManager(this.elements);

    this.setupEventHandlers();
    this.updateStateDisplay();
  }

  initializeUI() {
    this.elements = {
      status: document.getElementById("status"),
      feedback: document.getElementById("feedback"),
      timer: document.getElementById("timer"),
      recordBtn: document.getElementById("record"),
      stopBtn: document.getElementById("stop"),
      playBtn: document.getElementById("play"),
      downloadBtn: document.getElementById("download"),
      audioPlayer: document.getElementById("audioPlayer"),
      waveformCanvas: document.getElementById("waveform"),
      frequencyCanvas: document.getElementById("frequency"),
      lowFreqCanvas: document.getElementById("lowFreq"),
      midFreqCanvas: document.getElementById("midFreq"),
      highFreqCanvas: document.getElementById("highFreq"),
      volumeLevel: document.getElementById("volumeLevel"),
      toggleDisplayBtn: document.getElementById("toggleDisplay"),
      frequencyBandsView: document.getElementById("frequencyBandsView"),
      spectralView: document.getElementById("spectralView"),
      recorderState: document.getElementById("recorderState"),
      audioState: document.getElementById("audioState"),
      dataState: document.getElementById("dataState"),
      blobState: document.getElementById("blobState")
    };
  }

  setupEventHandlers() {
    this.elements.recordBtn.onclick = () => this.handleRecord();
    this.elements.stopBtn.onclick = () => this.handleStop();
    this.elements.playBtn.onclick = () => this.handlePlay();
    this.elements.downloadBtn.onclick = () => this.handleDownload();
    this.elements.toggleDisplayBtn.onclick = () => this.handleToggleDisplay();

    // Recorder callbacks
    this.recorder.onDataAvailable = () => this.updateStateDisplay();
    this.recorder.onStop = (url, blob) => this.handleRecordingStop(url, blob);
    this.recorder.onError = (error) => this.handleRecordingError(error);
    this.recorder.onTimer = (elapsed) => this.ui.updateTimer(elapsed);

    // Player callbacks
    this.player.onPlay = () => this.ui.updateStatus("▶️ Playing...", "idle");
    this.player.onPause = () => this.ui.updateStatus("⏸️ Paused", "idle");
    this.player.onEnded = () => {
      this.ui.showFeedback("✅ Playback finished");
      this.ui.setPlayButtonText(false);
    };
  }

  async handleRecord() {
    try {
      this.ui.showFeedback("🎤 Requesting microphone access...");
      this.ui.updateStatus("🔐 Requesting permission...", "idle");

      const analyser = await this.recorder.start();

      this.ui.showFeedback("✅ Microphone access granted!");
      this.updateStateDisplay();

      // Start visualization
      this.visualizer.setAnalyser(analyser);
      this.visualizer.start();

      this.ui.updateStatus("🔴 Recording...", "recording");
      this.ui.showFeedback("🔴 Recording started!");
      this.ui.setButtonStates({
        record: false,
        stop: true,
        play: false,
        download: false
      });
    } catch (error) {
      this.ui.showFeedback(`❌ Error: ${error.message}`);
      this.ui.updateStatus("❌ Error: " + error.message, "error");
      this.updateStateDisplay();
    }
  }

  handleStop() {
    if (this.recorder.isRecording()) {
      this.ui.showFeedback("⏹️ Stopping recording...");
      this.ui.updateStatus("⏹️ Stopping...", "idle");
      this.recorder.stop();
      this.visualizer.stop();
      this.updateStateDisplay();
    }
  }

  handleRecordingStop(url, blob) {
    this.ui.showFeedback("💾 Processing recording...");
    this.player.load(url);
    this.ui.updateStatus("✅ Recording saved!", "stopped");
    this.ui.setButtonStates({
      record: true,
      stop: false,
      play: true,
      download: true
    });
    this.ui.clearTimer();
    this.updateStateDisplay();
    this.ui.showFeedback("✅ Recording ready for playback!");
  }

  handleRecordingError(error) {
    this.ui.showFeedback(`❌ Recorder error: ${error.name}`);
    this.ui.updateStatus("❌ Error occurred", "error");
    this.updateStateDisplay();
  }

  handlePlay() {
    if (this.player.hasAudio()) {
      const isPlaying = this.player.play();
      if (isPlaying !== null) {
        this.ui.showFeedback(isPlaying ? "▶️ Playing recording..." : "⏸️ Paused playback");
        this.ui.setPlayButtonText(isPlaying);
      }
    } else {
      this.ui.showFeedback("❌ No recording available");
    }
  }

  handleDownload() {
    if (this.player.hasAudio()) {
      this.ui.showFeedback("💾 Downloading file...");
      const a = document.createElement("a");
      a.href = this.player.url;
      a.download = `sleep-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.webm`;
      a.click();
      this.ui.showFeedback("✅ Download started!");
    } else {
      this.ui.showFeedback("❌ No recording available");
    }
  }

  handleToggleDisplay() {
    const currentMode = this.visualizer.getDisplayMode();
    const newMode = currentMode === "bands" ? "spectral" : "bands";
    this.visualizer.setDisplayMode(newMode);
    this.ui.toggleVisualizerDisplay(newMode);
  }

  updateStateDisplay() {
    const recorderState = this.recorder.getState();
    this.ui.updateStateInfo(
      recorderState.recorderState,
      recorderState.streamActive,
      recorderState.chunksCount,
      recorderState.totalBytes,
      this.player.hasAudio()
    );
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new SleepRecorderApp();
});
