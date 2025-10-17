# Sleepy Recorder - Java Audio Recording Application

A cross-platform audio recording application with noise event detection, supporting both Desktop (JavaFX) and Android platforms.

## Features

- **Audio Recording**: Record audio in Ogg Opus format (48kHz, mono, 256kbps configurable)
- **Noise Detection**: Automatic detection of noise events above background level
  - Baseline calculation using 50th percentile
  - Configurable threshold (2.5x baseline = ~8dB louder)
  - Event merging and buffering
  - Chunked processing for large files
- **File Support**: Open and analyze existing Opus audio files
- **Playback**: Click events to play audio segments with 2-second padding
- **Android Background Recording**: Foreground service with wake lock for screen-locked recording

## Project Structure

```
sleepy-recorder/
├── core/                  # Shared core library
│   ├── codec/            # Opus encoder/decoder, Ogg container
│   ├── audio/            # Audio recorder/player abstractions
│   └── detection/        # Noise detection algorithm
├── desktop/              # JavaFX desktop application
└── android/              # Android application
```

## Requirements

### Desktop
- Java 17 or higher
- JavaFX 21
- Microphone access

### Android
- Android SDK 26+ (Android 8.0 Oreo)
- Target SDK 36
- Microphone permission
- Notification permission (Android 13+)

## Building

### Desktop Application

```bash
# Build
./gradlew :desktop:build

# Run
./gradlew :desktop:run

# Create distribution
./gradlew :desktop:installDist
```

The desktop app will be available in `desktop/build/install/desktop/bin/`

### Android Application

```bash
# Build APK
./gradlew :android:assembleDebug

# Install to connected device
./gradlew :android:installDebug
```

The APK will be in `android/build/outputs/apk/debug/`

## Usage

### Desktop

1. **Record**: Click "Record" to start recording
2. **Stop**: Click "Stop Recording" to finish
3. **Open**: Click "Open File..." to load an existing Opus file
4. **Analyze**: Files are automatically analyzed for noise events
5. **Play**: Click any event in the list to play it with 2-second padding

### Android

1. **Permissions**: Grant microphone and notification permissions on first launch
2. **Record**: Tap "Record" to start recording (continues even when screen is locked)
3. **Stop**: Tap "Stop" to finish recording
4. **Open**: Tap "Open File" to select an Opus file from storage
5. **Analyze**: Files are automatically analyzed for noise events
6. **Play**: Tap any event in the list to play it

The app runs a foreground service during recording, showing a notification.

## Configuration

### Audio Settings

Edit `core/src/main/java/com/sleepy/recorder/core/AudioConfig.java`:
- `SAMPLE_RATE`: 48000 Hz (Opus standard)
- `CHANNELS`: 1 (Mono)
- `BITRATE`: 256000 (256 kbps, configurable)
- `AVAILABLE_BITRATES`: Array of supported bitrates

### Noise Detection

Edit `core/src/main/java/com/sleepy/recorder/core/detection/NoiseDetectionConfig.java`:
- `BASELINE_PERCENTILE`: 0.5 (50th percentile = median)
- `NOISE_THRESHOLD_MULTIPLIER`: 2.5 (2.5x louder = ~8dB above baseline)
- `EVENT_PRE_BUFFER_MS`: 2000 (2 seconds before event)
- `EVENT_POST_BUFFER_MS`: 2000 (2 seconds after event)
- `MIN_EVENT_GAP_MS`: 1000 (merge events within 1 second)
- `SAMPLE_INTERVAL_MS`: 50 (calculate volume every 50ms)
- `CHUNK_DURATION_MS`: 300000 (5 minutes per chunk)
- `CHUNK_MAX_SIZE_BYTES`: 31457280 (30 MiB)

## Dependencies

### Core Module
- **Concentus**: Opus codec implementation (lostromb/concentus)
- Java Sound API for desktop
- Android AudioRecord API for mobile

### Desktop Module
- **JavaFX 21**: UI framework
  - javafx.controls
  - javafx.fxml

### Android Module
- **AndroidX**: AppCompat, Material, RecyclerView
- **Minimum SDK**: 26 (Android 8.0)
- **Target SDK**: 36

## Technical Details

### Audio Format
- **Codec**: Opus (via Concentus library)
- **Container**: Ogg
- **Sample Rate**: 48kHz
- **Channels**: Mono
- **Bit Depth**: 16-bit PCM (before encoding)
- **Bitrate**: 256kbps (configurable)
- **Frame Size**: 20ms (960 samples)

### Noise Detection Algorithm
1. Decode entire audio file to PCM
2. Sample volume (RMS) every 50ms
3. Calculate baseline as 50th percentile of all samples
4. Detect events where volume > baseline × 2.5
5. Merge events closer than 1 second
6. Add 2-second pre/post buffers for playback

### Android Foreground Service
- Service type: `microphone`
- Wake lock: `PARTIAL_WAKE_LOCK` (keeps CPU running when screen is off)
- Notification: Persistent notification showing recording status
- Lifecycle: Service stops automatically when recording completes

## File Format

Recordings are saved as `.opus` files (Ogg Opus container):
- Filename format: `recording_YYYYMMDD_HHmmss.opus`
- Desktop: Saved in working directory
- Android: Saved in app's external files directory

## Known Limitations

1. **Desktop playback**: Uses Java Sound API which may have limited Opus support (requires manual decoding)
2. **Chunked processing**: Large files are processed in 5-minute chunks to avoid memory issues
3. **Android file picker**: Only shows audio files, may need file manager with .opus support
4. **No real-time visualization**: Audio visualization during recording not yet implemented

## License

This project uses:
- Concentus (Opus codec) - Apache 2.0 License
- JavaFX - GPL v2 with Classpath Exception

## Future Enhancements

- [ ] Real-time noise detection during recording
- [ ] Live audio visualization (waveform/spectrum)
- [ ] Export events list to JSON/CSV
- [ ] Configurable bitrate selection in UI
- [ ] Support for other audio formats (import)
- [ ] Batch file analysis
