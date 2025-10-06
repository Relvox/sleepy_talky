export class AudioPlayer {
  constructor(audioElement) {
    this.audioElement = audioElement;
    this.url = null;
    this.onPlay = null;
    this.onPause = null;
    this.onEnded = null;
    this.onTimeUpdate = null;
    this.audioContext = null;
    this.analyser = null;
    this.source = null;

    this.audioElement.onplay = () => {
      if (this.onPlay) this.onPlay();
    };

    this.audioElement.onpause = () => {
      if (this.onPause && !this.audioElement.ended) this.onPause();
    };

    this.audioElement.onended = () => {
      if (this.onEnded) this.onEnded();
    };

    this.audioElement.ontimeupdate = () => {
      if (this.onTimeUpdate) this.onTimeUpdate();
    };
  }

  load(url) {
    this.url = url;
    this.audioElement.src = url;
  }

  setupAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
    }

    if (!this.source) {
      this.source = this.audioContext.createMediaElementSource(
        this.audioElement,
      );
      this.source.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
    }
  }

  play() {
    if (this.url) {
      this.setupAudioContext();
      if (this.audioElement.paused) {
        this.audioElement.play();
        return true;
      } else {
        this.audioElement.pause();
        return false;
      }
    }
    return null;
  }

  seek(time) {
    this.audioElement.currentTime = time;
  }

  getCurrentTime() {
    return this.audioElement.currentTime;
  }

  getDuration() {
    return this.audioElement.duration || 0;
  }

  getAnalyser() {
    return this.analyser;
  }

  isPlaying() {
    return !this.audioElement.paused;
  }

  hasAudio() {
    return !!this.url;
  }
}
