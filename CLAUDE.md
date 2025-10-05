# Sleep Recorder

Web-based audio recorder with real-time visualization for sleep/ambient sound recording.

## Architecture

**Frontend**: Vanilla JS (ES6 modules), HTML5, CSS3
**Backend**: Python HTTPS server with self-signed certificates
**APIs**: Web Audio API, MediaRecorder API

## Project Structure

```
sleepy/
├── index.html              # Main UI
├── style.css              # Styling
├── https_server.py        # HTTPS server (port 443)
└── js/
    ├── app.js             # Main application orchestrator
    ├── audio/
    │   ├── recorder.js    # MediaRecorder wrapper
    │   └── player.js      # Audio playback + analyser
    ├── ui/
    │   └── uiManager.js   # UI state management
    └── visualizers/
        ├── visualizationManager.js
        ├── frequencyBands.js    # Low/Mid/High freq bands
        └── spectral.js          # Waveform + FFT

```

## Features

- **Recording**: Audio capture with MediaRecorder (audio/mp4 or audio/webm)
- **Playback**: Scrubbing, play/pause control
- **Upload**: Load existing audio files
- **Download**: Save recordings with timestamp
- **Visualizations**:
  - Frequency bands (Low: 20-250Hz, Mid: 250-2kHz, High: 2kHz+)
  - Waveform + FFT spectrum
  - Real-time volume (dB)

## Setup

```bash
# Start HTTPS server (requires admin for port 443)
python https_server.py

# Access:
# - Local: https://localhost:8000
# - Network: https://<local-ip>:8000
```

## Key Implementation Details

- **Modular design**: Separate concerns (recorder, player, UI, visualizers)
- **Event-driven**: Callbacks for state changes
- **Constants extracted**: All magic numbers defined at module top
- **Real-time analysis**: Web Audio API AnalyserNode (FFT size: 2048)
- **Self-signed cert**: Auto-generated for HTTPS (required for getUserMedia)

## State Management

App tracks 4 states:
1. Recorder state (inactive/recording/stopped)
2. Audio stream (active/inactive)
3. Recorded data (chunks count, bytes)
4. Audio file (ready/not ready)

## Browser Requirements

- Modern browser with MediaRecorder API
- HTTPS context (for microphone access)
- Web Audio API support
