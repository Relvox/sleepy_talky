# Quick Start Guide

## Initial Setup

Since this is a fresh project, you'll need to initialize Gradle first:

```bash
# Initialize Gradle wrapper (run once)
gradle wrapper --gradle-version 8.5

# Or if you have Gradle installed:
gradle build
```

## Building and Running

### Desktop Application

```bash
# Build and run desktop app
gradle :desktop:run

# Or with wrapper (after initialization):
./gradlew :desktop:run          # Linux/Mac
gradlew.bat :desktop:run         # Windows
```

### Android Application

```bash
# Build debug APK
gradle :android:assembleDebug

# Install to connected device
gradle :android:installDebug

# Or with wrapper:
./gradlew :android:assembleDebug     # Linux/Mac
gradlew.bat :android:assembleDebug   # Windows
```

## First Run Checklist

### Desktop
1. Ensure Java 17+ is installed: `java -version`
2. Build: `gradle build`
3. Run: `gradle :desktop:run`
4. Grant microphone permissions when prompted

### Android
1. Ensure Android SDK is installed and configured
2. Set `ANDROID_HOME` environment variable
3. Connect Android device or start emulator
4. Build: `gradle :android:assembleDebug`
5. Install: `gradle :android:installDebug`
6. Grant microphone and notification permissions

## Troubleshooting

### "Gradle not found"
Install Gradle from https://gradle.org/install/ or use your package manager:
- Windows (Chocolatey): `choco install gradle`
- Mac (Homebrew): `brew install gradle`
- Linux: `sudo apt install gradle` or `sudo dnf install gradle`

### Android SDK not found
1. Download Android Studio or command-line tools
2. Set `ANDROID_HOME` to SDK location
3. Add `ANDROID_HOME/tools` and `ANDROID_HOME/platform-tools` to PATH

### JavaFX not loading
The build.gradle automatically downloads JavaFX. If issues persist:
1. Check Java version: `java -version` (must be 17+)
2. Run with `--stacktrace` flag for details

### Concentus dependency not found
The dependency is pulled from JitPack. If it fails:
1. Check internet connection
2. Try: `gradle build --refresh-dependencies`
3. Verify JitPack repository in core/build.gradle

## Testing Without Building

If you just want to verify the structure is correct:

```bash
# Check all modules
gradle projects

# Run tests (when available)
gradle test
```
