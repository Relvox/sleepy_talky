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
    this.onDataAvailable = null;
    this.onStop = null;
    this.onError = null;
    this.onTimer = null;
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
    this.mediaRecorder = new MediaRecorder(this.stream);

    this.mediaRecorder.ondataavailable = (e) => {
      this.chunks.push(e.data);
      if (this.onDataAvailable) {
        this.onDataAvailable(this.chunks);
      }
    };

    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.chunks, { type: "audio/webm" });
      const url = URL.createObjectURL(blob);

      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }

      if (this.onStop) {
        this.onStop(url, blob);
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
    }
  }

  isRecording() {
    return this.mediaRecorder && this.mediaRecorder.state !== "inactive";
  }

  getState() {
    return {
      recorderState: this.mediaRecorder
        ? this.mediaRecorder.state
        : "Not initialized",
      streamActive: this.stream && this.stream.active,
      chunksCount: this.chunks.length,
      totalBytes: this.chunks.reduce((acc, c) => acc + c.size, 0),
    };
  }
}
