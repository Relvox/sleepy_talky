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
    ├── detection/
    │   ├── noiseDetector.js      # Real-time noise detection
    │   └── offlineAnalyzer.js    # Offline file analysis
    ├── ui/
    │   └── uiManager.js   # UI state management
    └── visualizers/
        ├── visualizationManager.js
        ├── frequencyBands.js    # Low/Mid/High freq bands
        ├── spectral.js          # Waveform + FFT
        └── eventsList.js        # Noise events timeline

```

## Features

- **Recording**: Audio capture with MediaRecorder (audio/mp4 or audio/webm)
- **Playback**: Scrubbing, play/pause control
- **Upload**: Load existing audio files
- **Download**: Save recordings + manifest JSON with timestamp
- **Noise Detection**:
  - Real-time baseline calculation (5min intervals, 30th percentile)
  - Auto-detect events above 2x baseline
  - Event merging (1s gap), pre/post buffers (2s each)
  - Offline scanning for uploaded files
- **Visualizations** (3 modes):
  - Frequency bands (Low: 20-250Hz, Mid: 250-2kHz, High: 2kHz+)
  - Waveform + FFT spectrum
  - Events timeline with clickable playback
  - Real-time volume + baseline (dB)

## Setup

```bash
# Start HTTPS server (requires admin for port 443)
python https_server.py

# Access:
# - Local: https://localhost:8000
# - Network: https://<local-ip>:8000
```

## Key Implementation Details

- **Modular design**: Separate concerns (recorder, player, UI, visualizers, detection)
- **Event-driven**: Callbacks for state changes
- **Constants extracted**: All magic numbers defined at module top
- **Real-time analysis**: Web Audio API AnalyserNode (FFT size: 2048)
- **Self-signed cert**: Auto-generated for HTTPS (required for getUserMedia)
- **Dual detection modes**: Live (during recording) + offline (scan existing files)
- **Offline analysis**: Decodes audio buffer directly (no playback required)
- **Configurable detection**: Edit `noiseDetector.js` constants for tuning
- **Manifest persistence**: Auto-loads manifest.json files when uploading audio

## Noise Detection Configuration

Edit `js/detection/noiseDetector.js` to adjust:
- `BASELINE_INTERVAL_MS`: 300000 (5 minutes - how often to recalculate baseline)
- `BASELINE_PERCENTILE`: 0.3 (30th percentile - lower = quieter baseline)
- `NOISE_THRESHOLD_MULTIPLIER`: 2.0 (2x louder = +6dB threshold above baseline)
- `EVENT_PRE_BUFFER_MS`: 2000 (2 seconds before event)
- `EVENT_POST_BUFFER_MS`: 2000 (2 seconds after event)
- `MIN_EVENT_GAP_MS`: 1000 (merge events within 1 second)

**Note**: Threshold uses logarithmic dB scale. `NOISE_THRESHOLD_MULTIPLIER` of 2.0 adds ~6dB to baseline (20 × log₁₀(2)). For 3x louder, use 3.0 (+9.5dB).

## Usage

1. **Record**: Click 🎙️ to start recording with live noise detection
2. **Upload**: Click 📁 to load audio file (+ optional manifest.json with same name)
3. **Scan**: Click 🔍 to analyze uploaded file for noise events (no playback)
4. **View**: Toggle between frequency bands → waveform/FFT → events
5. **Events**: Click any event to jump to that timestamp
6. **Download**: Saves audio + manifest.json (if events detected)

### Manifest Auto-Loading
When uploading files, select both the audio file and its manifest JSON (if available). The app will automatically detect and load `filename-manifest.json` to display previously detected events without re-scanning.

## State Management

App tracks 5 states:
1. Recorder state (inactive/recording/stopped)
2. Audio stream (active/inactive)
3. Recorded data (chunks count, bytes)
4. Audio file (ready/not ready)
5. Noise events (baseline, event list)

## Browser Requirements

- Modern browser with MediaRecorder API
- HTTPS context (for microphone access)
- Web Audio API support
