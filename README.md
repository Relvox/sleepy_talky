# Sleepy Talky 😴

A web-based audio recorder designed for capturing and analyzing sleep sounds. Record ambient audio, detect noise events, and review what disturbed your sleep.

## ✨ Features

- **🎙️ Easy Recording**: One-click recording with real-time visualization
- **🔍 Smart Detection**: Automatically finds noise events above baseline levels
- **📊 Visual Analysis**: View frequency bands, waveforms, and event timelines
- **💾 Auto-Save**: Recordings persist in browser cache
- **📁 File Upload**: Analyze existing audio files
- **🌙 Sleep-Friendly**: Minimal UI for bedtime use

## 🚀 Quick Start

1. **Start the server** (requires Python):
   ```bash
   python https_server.py
   ```

2. **Open in browser**:
   - Local: `https://localhost`
   - From phone/tablet: `https://<your-computer-ip>`

3. **Accept the security warning** (self-signed certificate - this is safe for local use)

4. **Start recording**:
   - Click the 🎙️ microphone button
   - Allow microphone access when prompted
   - Click ⏹️ to stop

5. **Review events**:
   - Events are automatically detected and displayed
   - Click any event to play that moment

## 📱 Usage Tips

### Recording Sleep Sounds
1. Place device near your bed
2. Click 🎙️ before sleep
3. Click ⏹️ in the morning
4. Review the events timeline to see what woke you up

### Analyzing Existing Files
1. Click 📁 to upload an audio file
2. Events are automatically detected
3. Click events to jump to loud moments

### Understanding the Display

**While Recording:**
- Toggle between frequency bands and waveform/FFT views
- See real-time audio analysis

**After Recording:**
- View events timeline
- Click events to play specific moments
- Each event shows start time, duration, and peak volume

## ⚙️ Advanced Features

### Tuning Detection Sensitivity

Edit `js/detection/audioAnalyzer.js` constants to adjust:

```javascript
BASELINE_PERCENTILE = 0.5;            // Use median (50th percentile)
NOISE_THRESHOLD_MULTIPLIER = 2.5;     // Trigger at 2.5x baseline (~8dB louder)
EVENT_PRE_BUFFER_MS = 2000;           // Capture 2s before event
EVENT_POST_BUFFER_MS = 2000;          // Capture 2s after event
MIN_EVENT_GAP_MS = 1000;              // Merge events within 1s
SAMPLE_INTERVAL_MS = 50;              // Calculate volume every 50ms
CHUNK_DURATION_MS = 1800000;          // Process in 30-minute chunks
```

**Tips:**
- Lower `BASELINE_PERCENTILE` (e.g., 0.3) = quieter baseline, more sensitive
- Higher `NOISE_THRESHOLD_MULTIPLIER` (e.g., 3.0) = less sensitive, only loud events
- Increase `MIN_EVENT_GAP_MS` to merge more events together
- Adjust `CHUNK_DURATION_MS` for different memory/processing trade-offs

## 🔧 Technical Requirements

- **Browser**: Modern browser with Web Audio API and MediaRecorder support
  - Chrome, Edge, Safari, Firefox (latest versions)
- **Connection**: HTTPS required for microphone access
- **Python**: Any version with `http.server` module
- **Network**: Local network access for remote devices

## 🛠️ Troubleshooting

**"Microphone access denied"**
- Ensure HTTPS is working (not HTTP)
- Check browser permissions for microphone
- Try a different browser

**"Can't connect to server"**
- Verify server is running (`python https_server.py`)
- Check firewall allows port 443
- Try `sudo python https_server.py` on Linux/Mac

**"No events detected"**
- Audio may be consistently quiet
- Try adjusting sensitivity in `audioAnalyzer.js`
- Check microphone is working and not muted

**Server won't start on port 443**
- Port 443 requires admin/root privileges
- Windows: Run Command Prompt as Administrator
- Linux/Mac: Use `sudo python https_server.py`

## 📂 File Structure

```
sleepy/
├── index.html              # Main UI
├── style.css              # Styling
├── https_server.py        # HTTPS server
└── js/
    ├── app.js             # Main application
    ├── audio/             # Recording & playback
    ├── detection/         # Noise detection algorithms
    ├── storage/           # IndexedDB cache
    ├── ui/                # UI management
    └── visualizers/       # Audio visualizations
```

## 💡 How It Works

1. **Recording**: Captures audio using browser's MediaRecorder API
2. **Analysis**: Processes audio in 30-minute chunks for efficiency
3. **Baseline**: Calculates median volume level per chunk
4. **Detection**: Identifies events exceeding 2.5x baseline (~8dB louder, configurable)
5. **Buffering**: Captures 2 seconds before and after each event
6. **Merging**: Combines events within 1 second
7. **Storage**: Saves to IndexedDB for persistence
8. **Progress**: Real-time UI updates and detailed console logging

## 📜 License & Attributions

This project is licensed under the MIT License (see LICENSE file).

### Third-Party Libraries

**FFmpeg.wasm** - This software uses libraries from the [FFmpeg](http://ffmpeg.org) project under the [LGPLv2.1](http://www.gnu.org/licenses/old-licenses/lgpl-2.1.html) license.
- FFmpeg.wasm wrapper: MIT License
- FFmpeg core libraries: LGPL v2.1+
- Source code: [FFmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) | [FFmpeg.wasm-core](https://github.com/ffmpegwasm/ffmpeg.wasm-core) | [FFmpeg](https://github.com/FFmpeg/FFmpeg)
- Full license details: See [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md)

**Icons** - [Speech balloon icons created by Freepik - Flaticon](https://www.flaticon.com/free-icons/speech-balloon)

<img src="speech-bubble.png" height="64"/>
