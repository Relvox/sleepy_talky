# Sleep Recorder

Web-based audio recorder with real-time visualization for sleep/ambient sound recording.

## Architecture

**Frontend**: Vanilla JS (ES6 modules), HTML5, CSS3
**Backend**: Python HTTPS server with self-signed certificates
**APIs**: Web Audio API, MediaRecorder API, FFmpeg.wasm
**Libraries**: FFmpeg.wasm 0.12.10 (hosted locally for CORS compatibility)

## Project Structure

```
sleepy/
├── index.html              # Main UI
├── style.css              # Styling
├── https_server.py        # HTTPS server (port 443, CORS + MIME types)
├── libs/
│   └── ffmpeg/            # FFmpeg.wasm files (locally hosted)
│       ├── ffmpeg.js
│       ├── ffmpeg-util.js
│       ├── ffmpeg-core.js
│       ├── ffmpeg-core.wasm
│       └── 814.ffmpeg.js  # Worker chunk
└── js/
    ├── app.js             # Main application orchestrator
    ├── audio/
    │   ├── recorder.js    # MediaRecorder wrapper
    │   ├── player.js      # Audio playback + analyser
    │   └── ffmpegHelper.js # FFmpeg time-based chunk extraction
    ├── detection/
    │   └── audioAnalyzer.js # Unified audio analysis (FFmpeg-based chunking)
    ├── storage/
    │   └── recordingCache.js # IndexedDB persistence
    ├── ui/
    │   └── uiManager.js   # UI state management
    └── visualizers/
        ├── visualizationManager.js
        ├── frequencyBands.js # Low/Mid/High freq bands
        ├── spectral.js       # Waveform + FFT
        └── eventsList.js     # Noise events timeline
```

## Features

- **Recording**: Audio capture with MediaRecorder (audio/mp4 or audio/webm)
- **Playback**: Event-based playback from timeline
- **Upload**: Load existing audio files
- **Download**: Save recordings + manifest JSON with timestamp
- **Noise Detection**:
  - Time-based chunk analysis (30-minute intervals using FFmpeg extraction)
  - FFmpeg extracts specific time ranges without loading entire file
  - Baseline calculation from all volume samples (50th percentile)
  - Auto-detect events above 2.5x baseline (~8dB louder)
  - Event merging (1s gap), pre/post buffers (2s each)
  - Unified analysis for both recordings and uploaded files
  - Supports any audio format (M4A, WebM, MP3, WAV, etc.)
  - IndexedDB caching for session persistence
  - Real-time progress updates
- **Visualizations** (3 modes):
  - Frequency bands (Low: 20-250Hz, Mid: 250-2kHz, High: 2kHz+)
  - Waveform + FFT spectrum
  - Events timeline with clickable playback
  - Real-time volume + baseline (dB)

## Setup

```bash
# Start HTTPS server (requires admin/sudo for port 443)
python https_server.py

# Access:
# - Local: https://localhost:443
# - Network: https://<local-ip>:443
```

**Note**: Server auto-installs `cryptography` package if not present.

## Key Implementation Details

- **Modular design**: Separate concerns (recorder, player, UI, visualizers, detection, FFmpeg)
- **Event-driven**: Callbacks for state changes
- **Constants extracted**: All magic numbers defined at module top
- **Real-time visualization**: Web Audio API AnalyserNode (FFT size: 2048) during recording
- **Self-signed cert**: Auto-generated for HTTPS (required for getUserMedia)
- **Unified analysis**: Single code path for recordings and uploads
- **FFmpeg-based chunking**: Extracts 30-minute time ranges directly from audio files
  - Uses FFmpeg.wasm for time-accurate seeking and extraction
  - Converts chunks to WAV (PCM float32, 48kHz) for guaranteed decodability
  - Avoids memory crashes by processing one chunk at a time
  - Works with any container format (M4A, WebM, MP3, WAV, etc.)
  - No blob splitting - FFmpeg handles seeking within encoded stream
- **Offline analysis**: Decodes extracted chunks directly (no playback required)
- **Configurable detection**: Edit `audioAnalyzer.js` constants for tuning
- **Session persistence**: IndexedDB caches latest recording + events
- **Local FFmpeg hosting**: All FFmpeg.wasm files served locally to avoid CORS issues
- **HTTPS server enhancements**: Custom MIME types and CORS headers for WASM/JS files

## Noise Detection Configuration

Edit `js/detection/audioAnalyzer.js` constants to adjust:
- `BASELINE_PERCENTILE`: 0.5 (50th percentile - median value for baseline)
- `NOISE_THRESHOLD_MULTIPLIER`: 2.5 (2.5x louder = +8dB threshold above baseline)
- `EVENT_PRE_BUFFER_MS`: 2000 (2 seconds before event)
- `EVENT_POST_BUFFER_MS`: 2000 (2 seconds after event)
- `MIN_EVENT_GAP_MS`: 1000 (merge events within 1 second)
- `SAMPLE_INTERVAL_MS`: 50 (calculate volume every 50ms)
- `CHUNK_DURATION_MS`: 1800000 (process in 30-minute chunks)

**Note**: Threshold uses logarithmic dB scale. `NOISE_THRESHOLD_MULTIPLIER` of 2.5 adds ~8dB to baseline (20 × log₁₀(2.5)). For 3x louder, use 3.0 (+9.5dB).

## Usage

1. **Record**: Click 🎙️ to start recording with live noise detection
2. **Stop**: Click ⏹️ to stop recording (auto-analyzes for events)
3. **Upload**: Click 📁 to load audio file (auto-scans for events)
4. **View**: While recording: toggle frequency bands ↔ waveform/FFT | After recording: view events timeline
5. **Events**: Click any event to jump to that timestamp and play
6. **Download**: Saves audio file with timestamp

## Browser Requirements

- Modern browser with MediaRecorder API
- HTTPS context (for microphone access)
- Web Audio API support
