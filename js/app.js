import { AudioRecorder } from "./audio/recorder.js";
import { AudioPlayer } from "./audio/player.js";
import { VisualizationManager } from "./visualizers/visualizationManager.js";
import { UIManager } from "./ui/uiManager.js";

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
        highFreq: this.elements.highFreqCanvas,
      },
      this.elements.volumeLevel,
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
      uploadBtn: document.getElementById("upload"),
      fileInput: document.getElementById("fileInput"),
      progressSlider: document.getElementById("progressSlider"),
      currentTime: document.getElementById("currentTime"),
      duration: document.getElementById("duration"),
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
      blobState: document.getElementById("blobState"),
    };
  }

  setupEventHandlers() {
    this.elements.recordBtn.onclick = () => this.handleRecord();
    this.elements.stopBtn.onclick = () => this.handleStop();
    this.elements.playBtn.onclick = () => this.handlePlay();
    this.elements.downloadBtn.onclick = () => this.handleDownload();
    this.elements.uploadBtn.onclick = () => this.handleUpload();
    this.elements.fileInput.onchange = (e) => this.handleFileSelected(e);
    this.elements.toggleDisplayBtn.onclick = () => this.handleToggleDisplay();
    this.elements.progressSlider.oninput = (e) => this.handleSeek(e);

    // Recorder callbacks
    this.recorder.onDataAvailable = () => this.updateStateDisplay();
    this.recorder.onStop = (url, blob, mimeType) =>
      this.handleRecordingStop(url, blob, mimeType);
    this.recorder.onError = (error) => this.handleRecordingError(error);
    this.recorder.onTimer = (elapsed) => this.ui.updateTimer(elapsed);

    // Player callbacks
    this.player.onPlay = () => {
      this.ui.updateStatus("▶️ Playing...", "idle");
      this.startPlaybackVisualization();
    };
    this.player.onPause = () => {
      this.ui.updateStatus("⏸️ Paused", "idle");
      this.stopPlaybackVisualization();
    };
    this.player.onEnded = () => {
      this.ui.showFeedback("✅ Playback finished");
      this.ui.setPlayButtonText(false);
      this.stopPlaybackVisualization();
    };
    this.player.onTimeUpdate = () => this.updateProgress();
    this.player.onLoadedMetadata = () => this.updateDuration();
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
        download: false,
        upload: false,
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

  handleRecordingStop(url, blob, mimeType) {
    this.ui.showFeedback("💾 Processing recording...");
    this.player.load(url);
    this.recordedMimeType = mimeType;
    this.ui.updateStatus("✅ Recording saved!", "stopped");
    this.ui.setButtonStates({
      record: true,
      stop: false,
      play: true,
      download: true,
      upload: true,
    });
    this.ui.clearTimer();
    this.ui.resetProgress();
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
        this.ui.showFeedback(
          isPlaying ? "▶️ Playing recording..." : "⏸️ Paused playback",
        );
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

      // Determine file extension from MIME type
      let extension = "webm";
      if (this.recordedMimeType) {
        if (this.recordedMimeType.includes("mp4")) {
          extension = "m4a";
        } else if (this.recordedMimeType.includes("webm")) {
          extension = "webm";
        }
      }

      a.download = `sleep-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.${extension}`;
      a.click();
      this.ui.showFeedback("✅ Download started!");
    } else {
      this.ui.showFeedback("❌ No recording available");
    }
  }

  handleUpload() {
    this.elements.fileInput.click();
  }

  handleFileSelected(event) {
    const file = event.target.files[0];
    if (file) {
      if (!file.type.startsWith("audio/")) {
        this.ui.showFeedback("❌ Please select an audio file");
        return;
      }

      this.ui.showFeedback("📁 Loading file...");
      const url = URL.createObjectURL(file);
      this.player.load(url);
      this.ui.updateStatus("✅ File loaded!", "stopped");
      this.ui.setButtonStates({
        record: true,
        stop: false,
        play: true,
        download: true,
        upload: true,
      });
      this.ui.resetProgress();
      this.updateStateDisplay();
      this.ui.showFeedback("✅ File ready for playback!");
    }
  }

  handleSeek(event) {
    const percent = parseFloat(event.target.value);
    const duration = this.player.getDuration();
    const newTime = (percent / 100) * duration;
    this.player.seek(newTime);

    // Reset visualizations when seeking
    if (this.player.isPlaying()) {
      this.visualizer.clear();
    }
  }

  updateProgress() {
    const currentTime = this.player.getCurrentTime();
    const duration = this.player.getDuration();
    this.ui.updateProgress(currentTime, duration);
  }

  updateDuration() {
    const duration = this.player.getDuration();
    this.ui.updateDuration(duration);
  }

  startPlaybackVisualization() {
    const analyser = this.player.getAnalyser();
    if (analyser) {
      this.visualizer.setAnalyser(analyser);
      this.visualizer.start();
    }
  }

  stopPlaybackVisualization() {
    this.visualizer.stop();
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
      this.player.hasAudio(),
    );
  }
}

// Initialize app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new SleepRecorderApp();
});
