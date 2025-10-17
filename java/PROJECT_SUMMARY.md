# Sleepy Recorder - Project Summary

## ✅ Completed Implementation

A fully-featured cross-platform audio recording application with noise event detection.

## Architecture

### Multi-Module Gradle Project
```
sleepy-recorder/
├── settings.gradle                 # Multi-module configuration
├── build.gradle                    # Root build config
├── core/                          # Shared business logic
├── desktop/                       # JavaFX desktop app
└── android/                       # Android app
```

### Core Module (`core/`)
**Purpose**: Platform-independent audio processing and noise detection

**Key Components**:
1. **Codec Package** (`com.sleepy.recorder.core.codec`)
   - `OpusEncoder.java` - Encodes PCM to Opus using Concentus
   - `OpusDecoder.java` - Decodes Opus to PCM
   - `OggOpusWriter.java` - Writes Opus packets to Ogg container (RFC 7845)
   - `OggOpusReader.java` - Reads Opus packets from Ogg container

2. **Audio Package** (`com.sleepy.recorder.core.audio`)
   - `AudioRecorder.java` - Desktop recording using Java Sound API
   - `AudioPlayer.java` - Playback with time-range support

3. **Detection Package** (`com.sleepy.recorder.core.detection`)
   - `AudioAnalyzer.java` - Noise event detection algorithm
   - `NoiseEvent.java` - Event data model
   - `NoiseDetectionConfig.java` - Algorithm configuration

4. **Configuration** (`com.sleepy.recorder.core`)
   - `AudioConfig.java` - Audio format settings (48kHz, mono, 256kbps)

### Desktop Module (`desktop/`)
**Purpose**: JavaFX desktop application

**Key Components**:
- `DesktopApp.java` - JavaFX Application entry point
- `MainController.java` - UI controller with recording/playback logic
- `main.fxml` - JavaFX UI layout

**Features**:
- Record button → Start recording
- Stop button → End recording
- Open button → Load .opus files
- Events list → Shows detected noise events
- Play/Stop buttons → Playback event segments
- Progress bar → Analysis progress
- Status label → Current operation status

### Android Module (`android/`)
**Purpose**: Android application with foreground service

**Key Components**:
1. **Service**:
   - `RecordingService.java` - Foreground service with wake lock
   - `AndroidAudioRecorder.java` - Recording using AudioRecord API

2. **UI**:
   - `MainActivity.java` - Main activity with permissions handling
   - `EventsAdapter.java` - RecyclerView adapter for events
   - `activity_main.xml` - Main layout
   - `event_item.xml` - Event list item layout

**Features**:
- Background recording with foreground service notification
- Wake lock for screen-locked recording
- Runtime permissions (microphone, notifications)
- File picker for opening .opus files
- RecyclerView for events list
- Event playback

## Technical Specifications

### Audio Format
- **Codec**: Opus (via Concentus library)
- **Container**: Ogg
- **Sample Rate**: 48,000 Hz
- **Channels**: 1 (Mono)
- **Bit Depth**: 16-bit PCM (pre-encoding)
- **Bitrate**: 256 kbps (configurable: 64, 96, 128, 192, 256, 320, 510 kbps)
- **Frame Size**: 20ms (960 samples)
- **Application Type**: OPUS_APPLICATION_AUDIO

### Noise Detection Algorithm

**Configuration**:
- Baseline: 50th percentile (median) of all volume samples
- Threshold: 2.5× baseline (~8dB louder)
- Pre-buffer: 2000ms
- Post-buffer: 2000ms
- Event gap merging: 1000ms
- Sample interval: 50ms
- Chunk size: 5 minutes or 30 MiB

**Process**:
1. Decode Ogg Opus file to PCM
2. Calculate RMS volume every 50ms
3. Determine baseline (50th percentile of volumes)
4. Mark samples above threshold (baseline × 2.5)
5. Create events from continuous above-threshold segments
6. Merge events closer than 1 second
7. Add 2-second pre/post buffers for playback

**Formula**:
```
RMS = √(Σ(sample²) / count)
Baseline = percentile(volumes, 0.5)
Threshold = baseline × 2.5
Event = where volume > threshold
```

### Ogg Container Implementation

**RFC 7845 Compliance**:
- OpusHead identification header
- OpusTags comment header
- CRC-32 checksums for all pages
- Proper segment tables
- Granule position tracking

## Dependencies

### Core
- **Concentus** (lostromb/concentus) - Opus codec
  - Source: `com.github.lostromb:concentus:master-SNAPSHOT`
  - Repository: JitPack

### Desktop
- **JavaFX 21**
  - javafx.controls
  - javafx.fxml
- **Java 17+**

### Android
- **Android SDK 26+** (Oreo)
- **Target SDK 36**
- **AndroidX**:
  - appcompat:1.6.1
  - material:1.11.0
  - constraintlayout:2.1.4
  - recyclerview:1.3.2

## Build Instructions

### Prerequisites
1. Java 17 or higher
2. Gradle 8.5+ (or use `gradle wrapper`)
3. For Android: Android SDK with API 26-36

### Build Commands

```bash
# Initialize Gradle wrapper (first time)
gradle wrapper --gradle-version 9.0

# Build all modules
./gradlew build

# Run desktop app
./gradlew :desktop:run

# Build Android debug APK
./gradlew :android:assembleDebug

# Install Android app to device
./gradlew :android:installDebug
```

## File Outputs

### Desktop
- Location: Working directory
- Format: `recording_YYYYMMDD_HHmmss.opus`

### Android
- Location: App external files directory
- Format: `recording_YYYYMMDD_HHmmss.opus`
- Imported files: `imported_YYYYMMDD_HHmmss.opus` (in cache)

## Android Permissions

Required permissions in AndroidManifest.xml:
- `RECORD_AUDIO` - Microphone access
- `FOREGROUND_SERVICE` - Background recording
- `FOREGROUND_SERVICE_MICROPHONE` - Microphone in foreground service
- `POST_NOTIFICATIONS` - Show recording notification (Android 13+)
- `WAKE_LOCK` - Keep CPU running when screen off
- `READ_EXTERNAL_STORAGE` - File access (SDK ≤32)
- `WRITE_EXTERNAL_STORAGE` - File access (SDK ≤28)

## Key Features Implemented

✅ **Core Features**:
- [x] Opus encoding/decoding with Concentus
- [x] Ogg container read/write
- [x] Noise event detection algorithm
- [x] Chunked processing for large files
- [x] Configurable audio parameters
- [x] RMS volume calculation

✅ **Desktop Features**:
- [x] JavaFX UI with FXML
- [x] Audio recording from microphone
- [x] File open dialog
- [x] Events list view
- [x] Event playback with buffering
- [x] Progress indicators
- [x] Status updates

✅ **Android Features**:
- [x] Foreground service recording
- [x] Screen-locked recording support
- [x] Wake lock management
- [x] Runtime permission handling
- [x] File picker integration
- [x] RecyclerView events list
- [x] Material Design UI
- [x] Persistent notification

## Configuration Files

All configurable parameters are in Java constants:

1. **AudioConfig.java**:
   ```java
   SAMPLE_RATE = 48000
   CHANNELS = 1
   BITRATE = 256000
   AVAILABLE_BITRATES = {64k, 96k, 128k, 192k, 256k, 320k, 510k}
   ```

2. **NoiseDetectionConfig.java**:
   ```java
   BASELINE_PERCENTILE = 0.5
   NOISE_THRESHOLD_MULTIPLIER = 2.5
   EVENT_PRE_BUFFER_MS = 2000
   EVENT_POST_BUFFER_MS = 2000
   MIN_EVENT_GAP_MS = 1000
   SAMPLE_INTERVAL_MS = 50
   CHUNK_DURATION_MS = 300000  // 5 minutes
   ```

## Testing Recommendations

1. **Desktop Testing**:
   - Test microphone recording
   - Test file opening (.opus files)
   - Verify event detection on known audio
   - Test playback of event segments

2. **Android Testing**:
   - Test with screen locked
   - Verify notification appears
   - Test permissions flow
   - Test on different Android versions (26-36)
   - Verify wake lock is released after recording

3. **Integration Testing**:
   - Record on desktop, analyze on Android
   - Record on Android, analyze on desktop
   - Verify cross-platform file compatibility

## Known Considerations

1. **Concentus Dependency**: Uses JitPack with `master-SNAPSHOT` - consider pinning to a specific release tag for production
2. **Java Sound API**: Desktop playback requires manual Opus decoding (no native .opus support)
3. **Memory Management**: Chunked processing limits memory usage for large files
4. **Android Storage**: Uses scoped storage (external files directory)

## Next Steps for Production

1. Pin Concentus to a specific version/tag
2. Add unit tests for core modules
3. Add integration tests
4. Implement error recovery
5. Add logging framework
6. Consider real-time visualization
7. Add settings UI for configuration
8. Implement file export (events list to JSON/CSV)
9. Add batch file processing
10. Code signing for Android release builds

## Summary

The project is fully structured and ready to build. All core functionality is implemented:
- ✅ Multi-platform audio recording
- ✅ Opus encoding with Ogg container
- ✅ Noise event detection
- ✅ JavaFX desktop UI
- ✅ Android app with foreground service
- ✅ Event playback with buffering
- ✅ File import/export

Total files created: ~25 Java classes + build configs + layouts + documentation
