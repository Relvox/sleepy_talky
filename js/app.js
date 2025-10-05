import { AudioRecorder } from "./audio/recorder.js";
import { AudioPlayer } from "./audio/player.js";
import { VisualizationManager } from "./visualizers/visualizationManager.js";
import { UIManager } from "./ui/uiManager.js";
import { NoiseDetector } from "./detection/noiseDetector.js";
import { OfflineAudioAnalyzer } from "./detection/offlineAnalyzer.js";
import { RecordingCache } from "./storage/recordingCache.js";

class SleepRecorderApp {
  constructor() {
    // Check for debug mode in URL
    const urlParams = new URLSearchParams(window.location.search);
    this.debugMode = urlParams.has("debug");

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
        eventsContainer: this.elements.eventsContainer,
      },
      this.elements.volumeLevel,
    );
    this.ui = new UIManager(this.elements);
    this.noiseDetector = new NoiseDetector();
    this.offlineAnalyzer = new OfflineAudioAnalyzer();
    this.recordingCache = new RecordingCache();
    this.recordingBlob = null;
    this.uploadedAudioBlob = null;
    this.currentPlayingEventIndex = null;

    this.setupEventHandlers();
    this.applyDebugMode();
    this.updateStateDisplay();
    this.restoreCachedRecording();
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
      scanBtn: document.getElementById("scan"),
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
      baselineLevel: document.getElementById("baselineLevel"),
      bandsBtn: document.getElementById("bandsBtn"),
      spectralBtn: document.getElementById("spectralBtn"),
      eventsBtn: document.getElementById("eventsBtn"),
      frequencyBandsView: document.getElementById("frequencyBandsView"),
      spectralView: document.getElementById("spectralView"),
      eventsView: document.getElementById("eventsView"),
      eventsContainer: document.getElementById("eventsContainer"),
      recorderState: document.getElementById("recorderState"),
      audioState: document.getElementById("audioState"),
      dataState: document.getElementById("dataState"),
      blobState: document.getElementById("blobState"),
      stateInfo: document.getElementById("stateInfo"),
      progressContainer: document.querySelector(".progress-container"),
    };
  }

  setupEventHandlers() {
    this.elements.recordBtn.onclick = () => this.handleRecord();
    this.elements.stopBtn.onclick = () => this.handleStop();
    this.elements.playBtn.onclick = () => this.handlePlay();
    this.elements.downloadBtn.onclick = () => this.handleDownload();
    this.elements.uploadBtn.onclick = () => this.handleUpload();
    this.elements.scanBtn.onclick = () => this.handleScan();
    this.elements.fileInput.onchange = (e) => this.handleFileSelected(e);
    this.elements.bandsBtn.onclick = () => this.setDisplayMode("bands");
    this.elements.spectralBtn.onclick = () => this.setDisplayMode("spectral");
    this.elements.eventsBtn.onclick = () => this.setDisplayMode("events");
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
      // Don't clear playing index on pause - only update visual state
      this.visualizer.updatePlayingEvent(null);
    };
    this.player.onEnded = () => {
      this.ui.showFeedback("✅ Playback finished");
      this.ui.setPlayButtonText(false);
      this.stopPlaybackVisualization();
      this.currentPlayingEventIndex = null;
      this.visualizer.updatePlayingEvent(null);
    };
    this.player.onTimeUpdate = () => {
      this.updateProgress();
      this.checkEventEndTime();
    };
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
        scan: false,
      });

      // Update display mode buttons for recording state
      this.updateDisplayModeButtons();
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

      // Update display mode buttons for non-recording state
      this.updateDisplayModeButtons();
    }
  }

  async handleRecordingStop(url, blob, mimeType) {
    this.ui.showFeedback("💾 Processing recording...");
    this.player.load(url);
    this.recordedMimeType = mimeType;
    this.recordingBlob = blob;

    // Run offline analysis to detect noise events
    this.ui.showFeedback("🔍 Analyzing recording...");
    try {
      const { volumeSamples, duration } =
        await this.offlineAnalyzer.analyzeFile(blob, (progress) => {
          this.ui.showFeedback(`🔍 Analyzing... ${Math.round(progress)}%`);
        });

      const events = await this.offlineAnalyzer.analyzeSamples(
        volumeSamples,
        duration,
        this.noiseDetector,
      );

      if (events.length > 0) {
        this.ui.showFeedback(`📊 Found ${events.length} noise event(s)`);
        this.visualizer.updateEvents(events, duration);
        this.visualizer.renderEventsList(events, (event, index) =>
          this.playEvent(event, index),
        );
      } else {
        this.ui.showFeedback("✅ No noise events detected");
      }

      // Save to IndexedDB
      await this.saveRecordingToCache(blob, mimeType, events);
    } catch (error) {
      console.error("Analysis error:", error);
      this.ui.showFeedback("⚠️ Analysis failed, recording saved anyway");
    }

    this.ui.updateStatus("✅ Recording saved!", "stopped");
    this.ui.setButtonStates({
      record: true,
      stop: false,
      play: true,
      download: true,
      upload: true,
      scan: true,
    });
    this.ui.clearTimer();
    this.ui.resetProgress();
    this.updateStateDisplay();
    this.updateDisplayModeButtons();
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
    if (!this.player.hasAudio()) {
      this.ui.showFeedback("❌ No recording available");
      return;
    }

    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
    const extension = this.recordedMimeType?.includes("mp4") ? "m4a" : "webm";

    const link = document.createElement("a");
    link.href = this.player.url;
    link.download = `sleep-${timestamp}.${extension}`;
    link.click();

    this.ui.showFeedback("✅ Download started!");
  }

  handleUpload() {
    this.elements.fileInput.click();
  }

  async handleFileSelected(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("audio/")) {
      this.ui.showFeedback("❌ Please select an audio file");
      return;
    }

    this.ui.showFeedback("📁 Loading file...");
    this.player.load(URL.createObjectURL(file));
    this.uploadedAudioBlob = file;

    this.ui.updateStatus("✅ File loaded!", "stopped");
    this.ui.setButtonStates({
      record: true,
      stop: false,
      play: true,
      download: true,
      upload: true,
      scan: true,
    });
    this.ui.resetProgress();
    this.updateStateDisplay();

    // Auto-scan if not in debug mode
    if (!this.debugMode) {
      setTimeout(() => this.handleScan(), 500);
    } else {
      this.ui.showFeedback("✅ File ready for playback!");
    }
  }

  async handleScan() {
    if (!this.player.hasAudio() || !this.uploadedAudioBlob) {
      this.ui.showFeedback("❌ No audio file loaded");
      return;
    }

    try {
      this.ui.showFeedback("🔍 Analyzing audio for noise events...");
      this.ui.updateStatus("🔍 Scanning...", "recording");
      this.elements.scanBtn.disabled = true;

      // Reset noise detector
      this.noiseDetector = new NoiseDetector();

      // Analyze the audio file (without playback)
      const { volumeSamples, duration } =
        await this.offlineAnalyzer.analyzeFile(
          this.uploadedAudioBlob,
          (progress) => {
            this.ui.updateStatus(
              `🔍 Scanning... ${Math.round(progress)}%`,
              "recording",
            );
          },
        );

      // Process samples through noise detector
      await this.offlineAnalyzer.analyzeSamples(
        volumeSamples,
        duration,
        this.noiseDetector,
      );

      // Update UI with results
      const events = this.noiseDetector.getEvents();
      const baseline = this.noiseDetector.getBaseline();

      // Update baseline display
      if (baseline !== null && this.elements.baselineLevel) {
        this.elements.baselineLevel.style.display = "block";
        this.elements.baselineLevel.textContent = `Baseline: ${baseline.toFixed(1)} dB`;
      }

      if (events.length > 0) {
        this.visualizer.updateEvents(events, duration);
        this.visualizer.renderEventsList(events, (event, index) =>
          this.playEvent(event, index),
        );
        this.ui.showFeedback(`✅ Found ${events.length} noise event(s)!`);

        // Update display mode buttons and switch to events
        this.updateDisplayModeButtons();
        this.setDisplayMode("events");
      } else {
        this.ui.showFeedback("✅ No noise events detected");
      }

      this.ui.updateStatus("✅ Scan complete!", "stopped");
      this.elements.scanBtn.disabled = false;
    } catch (error) {
      console.error("[Scan Error]", error);
      console.error("Error stack:", error.stack);
      this.ui.showFeedback(`❌ Scan error: ${error.message}`);
      this.ui.updateStatus("❌ Scan failed", "error");
      this.elements.scanBtn.disabled = false;
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

  checkEventEndTime() {
    // If playing an event and reached its end time, stop playback
    if (this.currentPlayingEventIndex !== null && this.currentEventEndTime) {
      const currentTime = this.player.getCurrentTime();
      if (currentTime >= this.currentEventEndTime) {
        this.player.play(); // Pause
        this.currentPlayingEventIndex = null;
        this.currentEventEndTime = null;
        this.visualizer.updatePlayingEvent(null);
        this.ui.showFeedback("✅ Event playback finished");
      }
    }
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

  setDisplayMode(mode) {
    this.visualizer.setDisplayMode(mode);
    this.ui.toggleVisualizerDisplay(mode);

    // Update button active states
    this.elements.bandsBtn.classList.toggle("active", mode === "bands");
    this.elements.spectralBtn.classList.toggle("active", mode === "spectral");
    this.elements.eventsBtn.classList.toggle("active", mode === "events");
  }

  playEvent(event, index) {
    const startTime = event.startTime / 1000; // Convert to seconds
    const endTime = event.endTime / 1000; // Convert to seconds

    // If clicking the same event that's playing, pause it
    if (this.currentPlayingEventIndex === index && this.player.isPlaying()) {
      this.player.play(); // Toggle pause
      this.visualizer.updatePlayingEvent(null);
      this.ui.showFeedback(`⏸️ Paused event ${index + 1}`);
      return;
    }

    // Play the selected event
    this.player.seek(startTime);
    if (!this.player.isPlaying()) {
      this.player.play();
    }

    this.currentPlayingEventIndex = index;
    this.currentEventEndTime = endTime;
    this.visualizer.updatePlayingEvent(index);
    this.ui.showFeedback(`▶️ Playing event ${index + 1}`);
  }

  applyDebugMode() {
    if (!this.debugMode) {
      // Hide debug elements
      if (this.elements.playBtn) this.elements.playBtn.style.display = "none";
      if (this.elements.stateInfo)
        this.elements.stateInfo.style.display = "none";
      if (this.elements.progressContainer)
        this.elements.progressContainer.style.display = "none";
      if (this.elements.scanBtn) this.elements.scanBtn.style.display = "none"; // Auto-scan replaces manual button
    }

    // Set initial display mode visibility
    this.updateDisplayModeButtons();

    // Log debug mode status
    console.log(`[Debug Mode] ${this.debugMode ? "Enabled" : "Disabled"}`);
  }

  updateDisplayModeButtons() {
    const isRecording = this.recorder.isRecording();

    // Freq/Wave buttons only visible while recording
    if (this.elements.bandsBtn) {
      this.elements.bandsBtn.style.display = isRecording
        ? "inline-block"
        : "none";
    }
    if (this.elements.spectralBtn) {
      this.elements.spectralBtn.style.display = isRecording
        ? "inline-block"
        : "none";
    }

    // Events button not available while recording
    if (this.elements.eventsBtn) {
      this.elements.eventsBtn.style.display = isRecording
        ? "none"
        : "inline-block";
    }

    // Auto-switch to appropriate view
    if (isRecording) {
      this.setDisplayMode("bands");
    } else {
      // Show events if available
      const events = this.noiseDetector.getEvents();
      if (events && events.length > 0) {
        this.setDisplayMode("events");
      }
    }
  }

  updateStateDisplay() {
    if (!this.debugMode) return; // Skip in non-debug mode

    const recorderState = this.recorder.getState();
    this.ui.updateStateInfo(
      recorderState.recorderState,
      recorderState.streamActive,
      recorderState.chunksCount,
      recorderState.totalBytes,
      this.player.hasAudio(),
    );
  }

  async saveRecordingToCache(blob, mimeType, events) {
    try {
      await this.recordingCache.saveRecording(blob, mimeType, events);
      console.log("[Cache] Recording saved to IndexedDB");
    } catch (error) {
      console.error("[Cache] Failed to save recording:", error);
    }
  }

  async restoreCachedRecording() {
    try {
      const cached = await this.recordingCache.getLatestRecording();
      if (cached) {
        console.log(
          "[Cache] Restoring cached recording from",
          new Date(cached.timestamp),
        );

        // Create object URL and load into player
        const url = URL.createObjectURL(cached.blob);
        this.player.load(url);
        this.recordingBlob = cached.blob;
        this.recordedMimeType = cached.mimeType;

        // Restore events if available
        if (cached.events && cached.events.length > 0) {
          const duration = this.player.getDuration() * 1000;
          this.visualizer.updateEvents(cached.events, duration);
          this.visualizer.renderEventsList(cached.events, (event, index) =>
            this.playEvent(event, index),
          );
          this.ui.showFeedback(
            `📦 Restored recording with ${cached.events.length} event(s)`,
          );
        } else {
          this.ui.showFeedback("📦 Restored cached recording");
        }

        // Enable relevant buttons
        this.ui.setButtonStates({
          record: true,
          stop: false,
          play: true,
          download: true,
          upload: true,
          scan: true,
        });

        this.updateStateDisplay();
      }
    } catch (error) {
      console.error("[Cache] Failed to restore recording:", error);
    }
  }
}

// Initialize app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new SleepRecorderApp();
});
