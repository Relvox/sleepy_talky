let mediaRecorder = null;
let chunks = [];
let url = null;
let stream = null;
let startTime = null;
let timerInterval = null;
let audioContext = null;
let analyser = null;
let animationId = null;

const statusEl = document.getElementById("status");
const feedbackEl = document.getElementById("feedback");
const timerEl = document.getElementById("timer");
const recordBtn = document.getElementById("record");
const stopBtn = document.getElementById("stop");
const playBtn = document.getElementById("play");
const downloadBtn = document.getElementById("download");
const audioPlayer = document.getElementById("audioPlayer");
const waveformCanvas = document.getElementById("waveform");
const frequencyCanvas = document.getElementById("frequency");
const volumeLevel = document.getElementById("volumeLevel");
const waveformCtx = waveformCanvas.getContext("2d");
const frequencyCtx = frequencyCanvas.getContext("2d");

function showFeedback(message) {
  feedbackEl.textContent = message;
  feedbackEl.classList.add("show");
  setTimeout(() => feedbackEl.classList.remove("show"), 3000);
}

function updateState(status, className) {
  statusEl.textContent = status;
  statusEl.className = className;
}

function updateStateInfo() {
  document.getElementById("recorderState").textContent =
    `Recorder: ${mediaRecorder ? mediaRecorder.state : "Not initialized"}`;
  document.getElementById("audioState").textContent =
    `Audio stream: ${stream && stream.active ? "Active" : "Inactive"}`;
  document.getElementById("dataState").textContent =
    `Recorded data: ${chunks.length} chunk(s), ${chunks.reduce((acc, c) => acc + c.size, 0)} bytes`;
  document.getElementById("blobState").textContent =
    `Audio file: ${url ? "Ready for download" : "Not ready"}`;
}

function updateTimer() {
  if (startTime) {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    timerEl.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
}

recordBtn.onclick = async () => {
  try {
    // Check browser compatibility
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error(
        "Your browser doesn't support audio recording. Try using HTTPS or a modern browser.",
      );
    }

    showFeedback("🎤 Requesting microphone access...");
    updateState("🔐 Requesting permission...", "idle");

    stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });
    showFeedback("✅ Microphone access granted!");
    updateStateInfo();

    // Set up Web Audio API for real-time analysis
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    // Start visualization
    startVisualization();

    chunks = [];
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (e) => {
      chunks.push(e.data);
      updateStateInfo();
    };

    mediaRecorder.onstop = () => {
      showFeedback("💾 Processing recording...");
      const blob = new Blob(chunks, { type: "audio/webm" });
      url = URL.createObjectURL(blob);
      audioPlayer.src = url;
      updateState("✅ Recording saved!", "stopped");
      playBtn.disabled = false;
      downloadBtn.disabled = false;
      recordBtn.disabled = false;
      stopBtn.disabled = true;
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      updateStateInfo();
      showFeedback("✅ Recording ready for playback!");
    };

    mediaRecorder.onerror = (e) => {
      showFeedback(`❌ Recorder error: ${e.error.name}`);
      updateState("❌ Error occurred", "error");
      updateStateInfo();
    };

    mediaRecorder.start(1000);
    startTime = Date.now();
    timerInterval = setInterval(updateTimer, 100);

    updateState("🔴 Recording...", "recording");
    showFeedback("🔴 Recording started!");
    recordBtn.disabled = true;
    stopBtn.disabled = false;
    playBtn.disabled = true;
    downloadBtn.disabled = true;
    updateStateInfo();
  } catch (error) {
    showFeedback(`❌ Error: ${error.message}`);
    updateState("❌ Error: " + error.message, "error");
    updateStateInfo();
  }
};

stopBtn.onclick = () => {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    showFeedback("⏹️ Stopping recording...");
    updateState("⏹️ Stopping...", "idle");
    mediaRecorder.stop();

    // Stop visualization
    stopVisualization();

    if (stream) {
      stream.getTracks().forEach((track) => {
        track.stop();
        showFeedback(`🔇 Audio track stopped`);
      });
    }

    // Close audio context
    if (audioContext) {
      audioContext.close();
      audioContext = null;
      analyser = null;
    }

    updateStateInfo();
  }
};

playBtn.onclick = () => {
  if (url) {
    if (audioPlayer.paused) {
      showFeedback("▶️ Playing recording...");
      audioPlayer.play();
      playBtn.textContent = "⏸️";
    } else {
      showFeedback("⏸️ Paused playback");
      audioPlayer.pause();
      playBtn.textContent = "▶️";
    }
  } else {
    showFeedback("❌ No recording available");
  }
};

audioPlayer.onended = () => {
  showFeedback("✅ Playback finished");
  playBtn.textContent = "▶️";
};

audioPlayer.onplay = () => {
  updateState("▶️ Playing...", "idle");
};

audioPlayer.onpause = () => {
  if (!audioPlayer.ended) {
    updateState("⏸️ Paused", "idle");
  }
};

downloadBtn.onclick = () => {
  if (url) {
    showFeedback("💾 Downloading file...");
    const a = document.createElement("a");
    a.href = url;
    a.download = `sleep-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.webm`;
    a.click();
    showFeedback("✅ Download started!");
  } else {
    showFeedback("❌ No recording available");
  }
};

function startVisualization() {
  if (!analyser) return;

  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  const waveformData = new Uint8Array(bufferLength);

  function draw() {
    animationId = requestAnimationFrame(draw);

    // Get frequency data for FFT display
    analyser.getByteFrequencyData(dataArray);

    // Get waveform data for time-domain display
    analyser.getByteTimeDomainData(waveformData);

    // Calculate volume level (RMS)
    let sum = 0;
    for (let i = 0; i < waveformData.length; i++) {
      const normalized = (waveformData[i] - 128) / 128;
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / waveformData.length);
    const db = 20 * Math.log10(rms);
    volumeLevel.textContent = `Volume: ${db > -100 ? db.toFixed(1) + " dB" : "-∞ dB"}`;

    // Draw waveform
    waveformCtx.fillStyle = "#1a1a1a";
    waveformCtx.fillRect(0, 0, waveformCanvas.width, waveformCanvas.height);
    waveformCtx.lineWidth = 2;
    waveformCtx.strokeStyle = "#00ff00";
    waveformCtx.beginPath();

    const sliceWidth = waveformCanvas.width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = waveformData[i] / 128.0;
      const y = (v * waveformCanvas.height) / 2;

      if (i === 0) {
        waveformCtx.moveTo(x, y);
      } else {
        waveformCtx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    waveformCtx.stroke();

    // Draw frequency spectrum
    frequencyCtx.fillStyle = "#1a1a1a";
    frequencyCtx.fillRect(0, 0, frequencyCanvas.width, frequencyCanvas.height);

    const barWidth = (frequencyCanvas.width / bufferLength) * 2.5;
    let barHeight;
    x = 0;

    for (let i = 0; i < bufferLength; i++) {
      barHeight = (dataArray[i] / 255) * frequencyCanvas.height;

      const hue = (i / bufferLength) * 240;
      frequencyCtx.fillStyle = `hsl(${hue}, 100%, 50%)`;
      frequencyCtx.fillRect(
        x,
        frequencyCanvas.height - barHeight,
        barWidth,
        barHeight,
      );

      x += barWidth + 1;
    }
  }

  draw();
}

function stopVisualization() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  // Clear canvases
  waveformCtx.fillStyle = "#1a1a1a";
  waveformCtx.fillRect(0, 0, waveformCanvas.width, waveformCanvas.height);
  frequencyCtx.fillStyle = "#1a1a1a";
  frequencyCtx.fillRect(0, 0, frequencyCanvas.width, frequencyCanvas.height);
  volumeLevel.textContent = "Volume: --";
}

// Initialize state display
updateStateInfo();
