let mediaRecorder = null;
let chunks = [];
let url = null;
let stream = null;
let startTime = null;
let timerInterval = null;

const statusEl = document.getElementById("status");
const feedbackEl = document.getElementById("feedback");
const timerEl = document.getElementById("timer");
const recordBtn = document.getElementById("record");
const stopBtn = document.getElementById("stop");
const downloadBtn = document.getElementById("download");

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
        showFeedback("🎤 Requesting microphone access...");
        updateState("🔐 Requesting permission...", "idle");

        stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
        });
        showFeedback("✅ Microphone access granted!");
        updateStateInfo();

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
            updateState("✅ Recording saved!", "stopped");
            downloadBtn.disabled = false;
            recordBtn.disabled = false;
            stopBtn.disabled = true;
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
            updateStateInfo();
            showFeedback("✅ Recording ready for download!");
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
        if (stream) {
            stream.getTracks().forEach((track) => {
                track.stop();
                showFeedback(`🔇 Audio track stopped`);
            });
        }
        updateStateInfo();
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

// Initialize state display
updateStateInfo();
