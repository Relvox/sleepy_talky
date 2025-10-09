import { AudioRecorder } from "./audio/recorder.js";
import { AudioPlayer } from "./audio/player.js";
import { VisualizationManager } from "./visualizers/visualizationManager.js";
import { UIManager } from "./ui/uiManager.js";
import { AudioAnalyzer } from "./detection/audioAnalyzer.js";
import { RecordingCache } from "./storage/recordingCache.js";

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
        eventsContainer: this.elements.eventsContainer,
      },
      this.elements.volumeLevel,
    );
    this.ui = new UIManager(this.elements);
    this.analyzer = new AudioAnalyzer();
    this.recordingCache = new RecordingCache();
    this.recordingBlob = null;
    this.uploadedAudioBlob = null;
    this.currentPlayingEventIndex = null;

    this.setupEventHandlers();
    this.updateDisplayModeButtons();
    this.restoreCachedRecording();
  }

  initializeUI() {
    this.elements = {
      status: document.getElementById("status"),
      feedback: document.getElementById("feedback"),
      timer: document.getElementById("timer"),
      recordBtn: document.getElementById("record"),
      stopBtn: document.getElementById("stop"),
      downloadBtn: document.getElementById("download"),
      uploadBtn: document.getElementById("upload"),
      fileInput: document.getElementById("fileInput"),
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
    };
  }

  setupEventHandlers() {
    this.elements.recordBtn.onclick = () => this.handleRecord();
    this.elements.stopBtn.onclick = () => this.handleStop();
    this.elements.downloadBtn.onclick = () => this.handleDownload();
    this.elements.uploadBtn.onclick = () => this.handleUpload();
    this.elements.fileInput.onchange = (e) => this.handleFileSelected(e);
    this.elements.bandsBtn.onclick = () => this.setDisplayMode("bands");
    this.elements.spectralBtn.onclick = () => this.setDisplayMode("spectral");
    this.elements.eventsBtn.onclick = () => this.setDisplayMode("events");

    // Recorder callbacks
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
      this.stopPlaybackVisualization();
      this.currentPlayingEventIndex = null;
      this.visualizer.updatePlayingEvent(null);
    };
    this.player.onTimeUpdate = () => {
      this.checkEventEndTime();
    };
  }

  async handleRecord() {
    try {
      this.ui.showFeedback("🎤 Requesting microphone access...");
      this.ui.updateStatus("🔐 Requesting permission...", "idle");

      const analyser = await this.recorder.start();

      this.ui.showFeedback("✅ Microphone access granted!");

      // Start visualization
      this.visualizer.setAnalyser(analyser);
      this.visualizer.start();

      this.ui.updateStatus("🔴 Recording...", "recording");
      this.ui.showFeedback("🔴 Recording started!");
      this.ui.setButtonStates({
        record: false,
        stop: true,
        download: false,
        upload: false,
      });

      // Update display mode buttons for recording state
      this.updateDisplayModeButtons();
    } catch (error) {
      this.ui.showFeedback(`❌ Error: ${error.message}`);
      this.ui.updateStatus("❌ Error: " + error.message, "error");
    }
  }

  handleStop() {
    if (this.recorder.isRecording()) {
      this.ui.showFeedback("⏹️ Stopping recording...");
      this.ui.updateStatus("⏹️ Stopping...", "idle");
      this.recorder.stop();
      this.visualizer.stop();

      // Update display mode buttons for non-recording state
      this.updateDisplayModeButtons();
    }
  }

  async handleRecordingStop(url, blob, mimeType) {
    this.ui.showFeedback("💾 Processing recording...");
    this.player.load(url);
    this.recordedMimeType = mimeType;
    this.recordingBlob = blob;

    // Save to cache immediately (before analysis that might crash)
    await this.saveRecordingToCache(blob, mimeType, []);

    // Enable download button right away so user can save even if analysis fails
    this.ui.setButtonStates({
      record: true,
      stop: false,
      download: true,
      upload: true,
    });
    this.ui.updateStatus("✅ Recording saved!", "stopped");
    this.ui.clearTimer();
    this.updateDisplayModeButtons();

    // Run analysis
    await this.analyzeAudio(blob, mimeType);
  }

  handleRecordingError(error) {
    this.ui.showFeedback(`❌ Recorder error: ${error.name}`);
    this.ui.updateStatus("❌ Error occurred", "error");
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
      download: true,
      upload: true,
    });

    // Auto-scan uploaded files
    setTimeout(() => this.analyzeAudio(file, null), 500);
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

  async analyzeAudio(audioBlob, mimeType) {
    console.log(
      `[App] Starting audio analysis (mimeType: ${mimeType || "uploaded file"})`,
    );

    try {
      this.ui.showFeedback("🔍 Analyzing audio for noise events...");
      this.ui.updateStatus("🔍 Scanning...", "recording");

      // Analyze the audio file
      const { events, baseline, duration } = await this.analyzer.analyzeAudio(
        audioBlob,
        (progress) => {
          // Progress callback (0-100)
          console.log(`[App] Analysis progress: ${Math.round(progress)}%`);
        },
        (status) => {
          // Status update callback
          console.log(`[App] Status: ${status}`);
          this.ui.updateStatus(`🔍 ${status}`, "recording");
          this.ui.showFeedback(`🔍 ${status}`);
        },
      );

      console.log(
        `[App] Analysis complete: ${events.length} events, baseline: ${baseline.toFixed(1)} dB`,
      );

      // Update baseline display
      if (baseline !== null && this.elements.baselineLevel) {
        this.elements.baselineLevel.style.display = "block";
        this.elements.baselineLevel.textContent = `Baseline: ${baseline.toFixed(1)} dB`;
        console.log(`[App] Baseline displayed in UI`);
      }

      // Update UI with results
      if (events.length > 0) {
        console.log(`[App] Rendering ${events.length} events to UI`);
        this.visualizer.updateEvents(events, duration);
        this.visualizer.renderEventsList(events, (event, index) =>
          this.playEvent(event, index),
        );
        this.ui.showFeedback(`✅ Found ${events.length} noise event(s)!`);

        // Update display mode buttons and switch to events
        this.updateDisplayModeButtons();
        this.setDisplayMode("events");
        console.log(`[App] Switched to events view`);
      } else {
        this.ui.showFeedback("✅ No noise events detected");
        console.log(`[App] No events detected`);
      }

      this.ui.updateStatus("✅ Analysis complete!", "stopped");

      // Update cache if this was a recording (has mimeType)
      if (mimeType) {
        console.log(`[App] Saving to cache...`);
        await this.saveRecordingToCache(audioBlob, mimeType, events);
        console.log(`[App] Cache updated`);
      }
    } catch (error) {
      console.error("[App] Analysis Error:", error);
      console.error("[App] Error stack:", error.stack);
      this.ui.showFeedback(`❌ Analysis error: ${error.message}`);
      this.ui.updateStatus("❌ Analysis failed", "error");
    }
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
    }
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
          download: true,
          upload: true,
        });
      }
    } catch (error) {
      console.error("[Cache] Failed to restore recording:", error);
    }
  }
}

// Register service worker for PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("js/sw.js")
      .then((registration) => {
        console.log("[PWA] Service Worker registered:", registration.scope);

        // Check for updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          console.log("[PWA] New Service Worker found");

          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              console.log("[PWA] New content available, please reload");
              // Could show a notification to user here
            }
          });
        });
      })
      .catch((error) => {
        console.error("[PWA] Service Worker registration failed:", error);
      });
  });
}

// Initialize app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new SleepRecorderApp();
});
