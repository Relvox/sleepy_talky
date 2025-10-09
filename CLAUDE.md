# Sleep Recorder

Web-based audio recorder with real-time visualization for sleep/ambient sound recording.

## Architecture

**Frontend**: Vanilla JS (ES6 modules), HTML5, CSS3
**Backend**: Python HTTPS server with self-signed certificates
**APIs**: Web Audio API, MediaRecorder API, FFmpeg.wasm
**Libraries**: FFmpeg.wasm 0.12.10 (core files loaded from jsDelivr CDN)
**PWA**: Progressive Web App with offline support and installability

## Project Structure

```
sleepy/
├── index.html              # Main UI with PWA meta tags
├── style.css              # Styling
├── manifest.json          # PWA manifest
├── sw.js                  # Service Worker for offline support
├── https_server.py        # HTTPS server (port 443, CORS + MIME types)
├── icons/                 # PWA icons (generate from speech-bubble.png)
├── libs/
│   └── ffmpeg/            # FFmpeg.wasm wrapper files (core loaded from CDN)
│       ├── ffmpeg.js      # Main API wrapper (local)
│       └── ffmpeg-util.js # Utilities: toBlobURL, fetchFile (local)
│       # Note: ffmpeg-core.js, ffmpeg-core.wasm, 814.ffmpeg.js loaded from CDN
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
- **CDN-based FFmpeg**: Core files (~33MB) loaded from jsDelivr CDN using toBlobURL() for CORS bypass
- **HTTPS server**: Required for microphone access and PWA functionality
- **PWA Features**:
  - Service Worker for offline functionality
  - Installable on mobile and desktop
  - Cache-first strategy for static assets
  - Network-first for HTML to ensure fresh content
  - Automatic updates with service worker lifecycle management
  - App manifest with theme colors and icons

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
- HTTPS context (for microphone access and PWA)
- Web Audio API support
- Service Worker support (for PWA features)
- IndexedDB support (for offline caching)

## PWA Installation

### Desktop (Chrome/Edge):
1. Visit the site over HTTPS
2. Click the install icon (⊕) in the address bar
3. Or use menu → "Install Sleepy Talky"

### Mobile (iOS Safari):
1. Visit the site over HTTPS
2. Tap the Share button
3. Tap "Add to Home Screen"

### Mobile (Android Chrome):
1. Visit the site over HTTPS
2. Tap the three-dot menu
3. Tap "Add to Home Screen" or "Install App"

## Offline Support

The PWA caches all static assets for offline use:
- Core JavaScript modules
- CSS and HTML
- FFmpeg.wasm wrapper files (ffmpeg.js, ffmpeg-util.js)
- UI assets (icons, images)

**Note**: First-time FFmpeg usage requires internet to download core files (~33MB) from CDN. These are then cached by the Service Worker for offline use. Recording requires microphone access.
