// Constants for audio recorder
const FFT_SIZE = 2048;
const DATA_INTERVAL_MS = 1000;
const TIMER_UPDATE_INTERVAL_MS = 100;
const MS_TO_SECONDS = 1000;

export class AudioRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.chunks = [];
    this.stream = null;
    this.audioContext = null;
    this.analyser = null;
    this.startTime = null;
    this.timerInterval = null;
    this.onStop = null;
    this.onError = null;
    this.onTimer = null;
    this.mimeType = null;
    this.silentAudio = null; // Keep-awake audio element
  }

  async start() {
    // Check browser compatibility
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error(
        "Your browser doesn't support audio recording. Try using HTTPS or a modern browser.",
      );
    }

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });

    // Set up Web Audio API for real-time analysis
    this.audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = FFT_SIZE;
    const source = this.audioContext.createMediaStreamSource(this.stream);
    source.connect(this.analyser);

    this.chunks = [];

    // Try to use audio/mp4 (AAC) if supported, otherwise fall back to webm
    this.mimeType = "audio/webm";
    if (MediaRecorder.isTypeSupported("audio/mp4")) {
      this.mimeType = "audio/mp4";
    } else if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
      this.mimeType = "audio/webm;codecs=opus";
    }

    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType: this.mimeType,
    });

    this.mediaRecorder.ondataavailable = (e) => {
      this.chunks.push(e.data);
    };

    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.chunks, { type: this.mimeType });
      const url = URL.createObjectURL(blob);

      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }

      if (this.onStop) {
        this.onStop(url, blob, this.mimeType);
      }
    };

    this.mediaRecorder.onerror = (e) => {
      if (this.onError) {
        this.onError(e.error);
      }
    };

    this.mediaRecorder.start(DATA_INTERVAL_MS);
    this.startTime = Date.now();
    this.timerInterval = setInterval(() => {
      if (this.onTimer) {
        const elapsed = Math.floor(
          (Date.now() - this.startTime) / MS_TO_SECONDS,
        );
        this.onTimer(elapsed);
      }
    }, TIMER_UPDATE_INTERVAL_MS);

    // Play silent audio to prevent phone sleep (Android Chrome workaround)
    this.silentAudio = new Audio(
      "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=",
    );
    this.silentAudio.loop = true;
    this.silentAudio.volume = 0.01; // Very quiet but not 0
    this.silentAudio.play().catch((err) => {
      console.warn("Could not play keep-awake audio:", err);
    });

    return this.analyser;
  }

  stop() {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();

      if (this.stream) {
        this.stream.getTracks().forEach((track) => {
          track.stop();
        });
      }

      if (this.audioContext) {
        this.audioContext.close();
        this.audioContext = null;
        this.analyser = null;
      }

      // Stop keep-awake audio
      if (this.silentAudio) {
        this.silentAudio.pause();
        this.silentAudio = null;
      }
    }
  }

  isRecording() {
    return this.mediaRecorder && this.mediaRecorder.state !== "inactive";
  }
}
