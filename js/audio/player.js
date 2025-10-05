export class AudioPlayer {
  constructor(audioElement) {
    this.audioElement = audioElement;
    this.url = null;
    this.onPlay = null;
    this.onPause = null;
    this.onEnded = null;

    this.audioElement.onplay = () => {
      if (this.onPlay) this.onPlay();
    };

    this.audioElement.onpause = () => {
      if (this.onPause && !this.audioElement.ended) this.onPause();
    };

    this.audioElement.onended = () => {
      if (this.onEnded) this.onEnded();
    };
  }

  load(url) {
    this.url = url;
    this.audioElement.src = url;
  }

  play() {
    if (this.url) {
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

  isPlaying() {
    return !this.audioElement.paused;
  }

  hasAudio() {
    return !!this.url;
  }
}
