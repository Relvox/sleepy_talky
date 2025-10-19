package com.sleepy.recorder.android;

import android.Manifest;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.content.pm.PackageManager;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.widget.Button;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import com.sleepy.recorder.core.detection.NoiseEvent;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/**
 * Main activity for Android app
 */
public class MainActivity extends AppCompatActivity {

    private static final int PERMISSION_REQUEST_CODE = 1;

    private Button recordButton;
    private Button stopButton;
    private Button saveButton;
    private Button discardButton;
    private Button openButton;
    private TextView statusText;
    private RecyclerView eventsRecyclerView;
    private ProgressBar analysisProgress;

    private RecordingService recordingService;
    private boolean serviceBound = false;
    private AndroidAudioAnalyzer audioAnalyzer;
    private MediaPlayer mediaPlayer;
    private File currentFile;
    private File tempRecordingFile;
    private EventsAdapter eventsAdapter;

    private ActivityResultLauncher<String> filePickerLauncher;
    private ActivityResultLauncher<String> fileSaverLauncher;

    private final ServiceConnection serviceConnection =
        new ServiceConnection() {
            @Override
            public void onServiceConnected(
                ComponentName name,
                IBinder service
            ) {
                RecordingService.RecordingBinder binder =
                    (RecordingService.RecordingBinder) service;
                recordingService = binder.getService();
                serviceBound = true;
            }

            @Override
            public void onServiceDisconnected(ComponentName name) {
                serviceBound = false;
            }
        };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        // Initialize views
        recordButton = findViewById(R.id.recordButton);
        stopButton = findViewById(R.id.stopButton);
        saveButton = findViewById(R.id.saveButton);
        discardButton = findViewById(R.id.discardButton);
        openButton = findViewById(R.id.openButton);
        statusText = findViewById(R.id.statusText);
        eventsRecyclerView = findViewById(R.id.eventsRecyclerView);
        analysisProgress = findViewById(R.id.analysisProgress);

        // Initialize audio components
        audioAnalyzer = new AndroidAudioAnalyzer();

        // Setup RecyclerView
        eventsAdapter = new EventsAdapter(new ArrayList<>(), this::playEvent);
        eventsRecyclerView.setLayoutManager(new LinearLayoutManager(this));
        eventsRecyclerView.setAdapter(eventsAdapter);

        // Setup buttons
        recordButton.setOnClickListener(v -> startRecording());
        stopButton.setOnClickListener(v -> stopRecording());
        saveButton.setOnClickListener(v -> saveRecording());
        discardButton.setOnClickListener(v -> discardRecording());
        openButton.setOnClickListener(v -> openFile());

        // Initial button states
        updateButtonStates(false, false);

        // File picker launcher (for opening files)
        filePickerLauncher = registerForActivityResult(
            new ActivityResultContracts.GetContent(),
            this::handleSelectedFile
        );

        // File saver launcher (for saving recordings)
        fileSaverLauncher = registerForActivityResult(
            new ActivityResultContracts.CreateDocument("audio/ogg"),
            this::handleSaveLocation
        );

        // Request permissions
        requestPermissions();

        analysisProgress.setVisibility(ProgressBar.GONE);
    }

    @Override
    protected void onStart() {
        super.onStart();
        // Bind to service
        Intent intent = new Intent(this, RecordingService.class);
        bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE);
    }

    @Override
    protected void onStop() {
        super.onStop();
        if (serviceBound) {
            unbindService(serviceConnection);
            serviceBound = false;
        }
    }

    @Override
    protected void onDestroy() {
        if (mediaPlayer != null) {
            mediaPlayer.release();
            mediaPlayer = null;
        }
        cleanupTempFile();
        super.onDestroy();
    }

    private void requestPermissions() {
        List<String> permissions = new ArrayList<>();

        if (
            ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.RECORD_AUDIO
            ) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            permissions.add(Manifest.permission.RECORD_AUDIO);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (
                ContextCompat.checkSelfPermission(
                    this,
                    Manifest.permission.POST_NOTIFICATIONS
                ) !=
                PackageManager.PERMISSION_GRANTED
            ) {
                permissions.add(Manifest.permission.POST_NOTIFICATIONS);
            }
        }

        if (!permissions.isEmpty()) {
            ActivityCompat.requestPermissions(
                this,
                permissions.toArray(new String[0]),
                PERMISSION_REQUEST_CODE
            );
        }
    }

    @Override
    public void onRequestPermissionsResult(
        int requestCode,
        @NonNull String[] permissions,
        @NonNull int[] grantResults
    ) {
        super.onRequestPermissionsResult(
            requestCode,
            permissions,
            grantResults
        );

        if (requestCode == PERMISSION_REQUEST_CODE) {
            for (int result : grantResults) {
                if (result != PackageManager.PERMISSION_GRANTED) {
                    Toast.makeText(
                        this,
                        "Permissions required for recording",
                        Toast.LENGTH_LONG
                    ).show();
                    return;
                }
            }
        }
    }

    private void startRecording() {
        if (!serviceBound) {
            Toast.makeText(
                this,
                "Service not ready",
                Toast.LENGTH_SHORT
            ).show();
            return;
        }

        // Generate temporary filename
        String timestamp = new SimpleDateFormat(
            "yyyyMMdd_HHmmss",
            Locale.getDefault()
        ).format(new Date());
        File recordingFile = new File(
            getCacheDir(),
            "temp_recording_" + timestamp + ".ogg"
        );

        // Start service
        Intent serviceIntent = new Intent(this, RecordingService.class);
        ContextCompat.startForegroundService(this, serviceIntent);

        // Start recording
        recordingService.startRecording(
            recordingFile,
            new RecordingService.RecordingCallback() {
                @Override
                public void onAudioData(byte[] data, int length) {
                    // Could add live visualization
                }

                @Override
                public void onRecordingComplete(File file) {
                    runOnUiThread(() -> {
                        tempRecordingFile = file;
                        currentFile = file; // For analysis and playback
                        updateStatus("Recording complete. Save or discard?");
                        updateButtonStates(false, true);
                        analyzeFile(file);
                    });
                }

                @Override
                public void onError(Exception e) {
                    runOnUiThread(() -> {
                        Toast.makeText(
                            MainActivity.this,
                            "Recording error: " + e.getMessage(),
                            Toast.LENGTH_LONG
                        ).show();
                        updateButtonStates(false, false);
                        cleanupTempFile();
                    });
                }
            }
        );

        updateStatus("Recording...");
        updateButtonStates(true, false);
    }

    private void stopRecording() {
        if (serviceBound && recordingService != null) {
            recordingService.stopRecording();
            updateStatus("Stopping recording...");
        }
    }

    private void saveRecording() {
        if (tempRecordingFile == null || !tempRecordingFile.exists()) {
            Toast.makeText(
                this,
                "No recording to save",
                Toast.LENGTH_SHORT
            ).show();
            return;
        }

        // Generate default filename with timestamp
        String timestamp = new SimpleDateFormat(
            "yyyyMMdd_HHmmss",
            Locale.getDefault()
        ).format(new Date());
        String defaultName = "recording_" + timestamp + ".ogg";

        // Launch file saver
        fileSaverLauncher.launch(defaultName);
    }

    private void handleSaveLocation(Uri uri) {
        if (uri == null || tempRecordingFile == null) {
            return; // User cancelled
        }

        try {
            // Copy temp file to selected location
            try (
                InputStream input = new java.io.FileInputStream(
                    tempRecordingFile
                );
                java.io.OutputStream output =
                    getContentResolver().openOutputStream(uri)
            ) {
                byte[] buffer = new byte[8192];
                int bytesRead;
                while ((bytesRead = input.read(buffer)) != -1) {
                    output.write(buffer, 0, bytesRead);
                }
            }

            // Clean up temp file
            tempRecordingFile.delete();
            tempRecordingFile = null;

            updateStatus("Recording saved");
            updateButtonStates(false, false);
            Toast.makeText(
                this,
                "Recording saved successfully",
                Toast.LENGTH_SHORT
            ).show();
        } catch (Exception e) {
            Toast.makeText(
                this,
                "Error saving file: " + e.getMessage(),
                Toast.LENGTH_LONG
            ).show();
        }
    }

    private void discardRecording() {
        if (tempRecordingFile == null) {
            return;
        }

        // Show confirmation dialog
        new androidx.appcompat.app.AlertDialog.Builder(this)
            .setTitle("Discard Recording")
            .setMessage(
                "Are you sure you want to permanently delete this recording?"
            )
            .setPositiveButton("Discard", (dialog, which) -> {
                cleanupTempFile();
                currentFile = null;
                eventsAdapter.clearEvents();
                updateStatus("Recording discarded");
                updateButtonStates(false, false);
                Toast.makeText(
                    this,
                    "Recording discarded",
                    Toast.LENGTH_SHORT
                ).show();
            })
            .setNegativeButton("Cancel", null)
            .show();
    }

    private void cleanupTempFile() {
        if (tempRecordingFile != null && tempRecordingFile.exists()) {
            tempRecordingFile.delete();
            tempRecordingFile = null;
        }
    }

    private void openFile() {
        filePickerLauncher.launch("audio/*");
    }

    private void handleSelectedFile(Uri uri) {
        if (uri == null) {
            return;
        }

        try {
            // Copy file to app storage
            String timestamp = new SimpleDateFormat(
                "yyyyMMdd_HHmmss",
                Locale.getDefault()
            ).format(new Date());
            File tempFile = new File(
                getCacheDir(),
                "imported_" + timestamp + ".opus"
            );

            try (
                InputStream input = getContentResolver().openInputStream(uri);
                FileOutputStream output = new FileOutputStream(tempFile)
            ) {
                byte[] buffer = new byte[8192];
                int bytesRead;
                while ((bytesRead = input.read(buffer)) != -1) {
                    output.write(buffer, 0, bytesRead);
                }
            }

            currentFile = tempFile;
            updateStatus("Opened: " + uri.getLastPathSegment());
            analyzeFile(tempFile);
        } catch (Exception e) {
            Toast.makeText(
                this,
                "Error opening file: " + e.getMessage(),
                Toast.LENGTH_LONG
            ).show();
        }
    }

    private void analyzeFile(File file) {
        eventsAdapter.clearEvents();
        analysisProgress.setVisibility(ProgressBar.VISIBLE);
        analysisProgress.setProgress(0);
        updateStatus("Analyzing audio...");

        new Thread(() -> {
            try {
                List<NoiseEvent> events = audioAnalyzer.analyzeFile(
                    file,
                    progress -> {
                        runOnUiThread(() ->
                            analysisProgress.setProgress((int) (progress * 100))
                        );
                    }
                );

                runOnUiThread(() -> {
                    eventsAdapter.setEvents(events);
                    analysisProgress.setVisibility(ProgressBar.GONE);
                    updateStatus("Found " + events.size() + " noise events");
                });
            } catch (Exception e) {
                runOnUiThread(() -> {
                    analysisProgress.setVisibility(ProgressBar.GONE);
                    Toast.makeText(
                        MainActivity.this,
                        "Analysis error: " + e.getMessage(),
                        Toast.LENGTH_LONG
                    ).show();
                });
            }
        })
            .start();
    }

    private void playEvent(NoiseEvent event) {
        if (currentFile == null) {
            return;
        }

        try {
            // Release previous player if exists
            if (mediaPlayer != null) {
                mediaPlayer.release();
            }

            // Create new MediaPlayer
            mediaPlayer = new MediaPlayer();
            mediaPlayer.setDataSource(currentFile.getAbsolutePath());
            mediaPlayer.prepare();

            // Seek to event start position
            int startMs = (int) Math.max(0, event.getPlaybackStartMs());
            int endMs = (int) event.getPlaybackEndMs();
            int duration = endMs - startMs;

            mediaPlayer.seekTo(startMs);
            mediaPlayer.start();

            updateStatus(
                "Playing event at " + formatTime(event.getStartTimeMs())
            );

            // Stop playback at event end
            new Thread(() -> {
                try {
                    Thread.sleep(duration);
                    runOnUiThread(() -> {
                        if (mediaPlayer != null && mediaPlayer.isPlaying()) {
                            mediaPlayer.pause();
                            mediaPlayer.seekTo(0);
                        }
                        updateStatus("Playback complete");
                    });
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            })
                .start();
        } catch (Exception e) {
            Toast.makeText(
                this,
                "Playback error: " + e.getMessage(),
                Toast.LENGTH_LONG
            ).show();
        }
    }

    private void updateButtonStates(
        boolean recording,
        boolean hasUnsavedRecording
    ) {
        recordButton.setEnabled(!recording && !hasUnsavedRecording);
        stopButton.setEnabled(recording);
        saveButton.setEnabled(hasUnsavedRecording);
        discardButton.setEnabled(hasUnsavedRecording);
        openButton.setEnabled(!recording && !hasUnsavedRecording);
    }

    private void updateStatus(String message) {
        statusText.setText(message);
    }

    private String formatTime(long milliseconds) {
        long seconds = milliseconds / 1000;
        long minutes = seconds / 60;
        seconds = seconds % 60;
        return String.format(Locale.getDefault(), "%d:%02d", minutes, seconds);
    }
}
