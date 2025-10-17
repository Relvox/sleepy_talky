package com.sleepy.recorder.android;

import android.Manifest;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.content.pm.PackageManager;
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

import com.sleepy.recorder.core.audio.AudioPlayer;
import com.sleepy.recorder.core.detection.AudioAnalyzer;
import com.sleepy.recorder.core.detection.NoiseEvent;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

import javax.sound.sampled.LineUnavailableException;

/**
 * Main activity for Android app
 */
public class MainActivity extends AppCompatActivity {
    private static final int PERMISSION_REQUEST_CODE = 1;

    private Button recordButton;
    private Button stopButton;
    private Button openButton;
    private TextView statusText;
    private RecyclerView eventsRecyclerView;
    private ProgressBar analysisProgress;

    private RecordingService recordingService;
    private boolean serviceBound = false;
    private AudioPlayer audioPlayer;
    private AudioAnalyzer audioAnalyzer;
    private File currentFile;
    private EventsAdapter eventsAdapter;

    private ActivityResultLauncher<String> filePickerLauncher;

    private final ServiceConnection serviceConnection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder service) {
            RecordingService.RecordingBinder binder = (RecordingService.RecordingBinder) service;
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
        openButton = findViewById(R.id.openButton);
        statusText = findViewById(R.id.statusText);
        eventsRecyclerView = findViewById(R.id.eventsRecyclerView);
        analysisProgress = findViewById(R.id.analysisProgress);

        // Initialize audio components
        audioPlayer = new AudioPlayer();
        audioAnalyzer = new AudioAnalyzer();

        // Setup RecyclerView
        eventsAdapter = new EventsAdapter(new ArrayList<>(), this::playEvent);
        eventsRecyclerView.setLayoutManager(new LinearLayoutManager(this));
        eventsRecyclerView.setAdapter(eventsAdapter);

        // Setup buttons
        recordButton.setOnClickListener(v -> startRecording());
        stopButton.setOnClickListener(v -> stopRecording());
        openButton.setOnClickListener(v -> openFile());

        // Initial button states
        updateButtonStates(false);

        // File picker launcher
        filePickerLauncher = registerForActivityResult(
                new ActivityResultContracts.GetContent(),
                this::handleSelectedFile
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
        if (audioPlayer != null && audioPlayer.isPlaying()) {
            audioPlayer.stop();
        }
        super.onDestroy();
    }

    private void requestPermissions() {
        List<String> permissions = new ArrayList<>();

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.RECORD_AUDIO);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.POST_NOTIFICATIONS);
            }
        }

        if (!permissions.isEmpty()) {
            ActivityCompat.requestPermissions(this,
                    permissions.toArray(new String[0]),
                    PERMISSION_REQUEST_CODE);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions,
                                          @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode == PERMISSION_REQUEST_CODE) {
            for (int result : grantResults) {
                if (result != PackageManager.PERMISSION_GRANTED) {
                    Toast.makeText(this, "Permissions required for recording", Toast.LENGTH_LONG).show();
                    return;
                }
            }
        }
    }

    private void startRecording() {
        if (!serviceBound) {
            Toast.makeText(this, "Service not ready", Toast.LENGTH_SHORT).show();
            return;
        }

        // Generate filename
        String timestamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(new Date());
        File recordingFile = new File(getExternalFilesDir(null), "recording_" + timestamp + ".opus");

        // Start service
        Intent serviceIntent = new Intent(this, RecordingService.class);
        ContextCompat.startForegroundService(this, serviceIntent);

        // Start recording
        recordingService.startRecording(recordingFile, new RecordingService.RecordingCallback() {
            @Override
            public void onAudioData(byte[] data, int length) {
                // Could add live visualization
            }

            @Override
            public void onRecordingComplete(File file) {
                runOnUiThread(() -> {
                    currentFile = file;
                    updateStatus("Recording saved: " + file.getName());
                    updateButtonStates(false);
                    analyzeFile(file);
                });
            }

            @Override
            public void onError(Exception e) {
                runOnUiThread(() -> {
                    Toast.makeText(MainActivity.this, "Recording error: " + e.getMessage(),
                            Toast.LENGTH_LONG).show();
                    updateButtonStates(false);
                });
            }
        });

        updateStatus("Recording...");
        updateButtonStates(true);
    }

    private void stopRecording() {
        if (serviceBound && recordingService != null) {
            recordingService.stopRecording();
            updateStatus("Stopping recording...");
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
            String timestamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(new Date());
            File tempFile = new File(getCacheDir(), "imported_" + timestamp + ".opus");

            try (InputStream input = getContentResolver().openInputStream(uri);
                 FileOutputStream output = new FileOutputStream(tempFile)) {

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
            Toast.makeText(this, "Error opening file: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private void analyzeFile(File file) {
        eventsAdapter.clearEvents();
        analysisProgress.setVisibility(ProgressBar.VISIBLE);
        analysisProgress.setProgress(0);
        updateStatus("Analyzing audio...");

        new Thread(() -> {
            try {
                List<NoiseEvent> events = audioAnalyzer.analyzeFile(file, progress -> {
                    runOnUiThread(() -> analysisProgress.setProgress((int) (progress * 100)));
                });

                runOnUiThread(() -> {
                    eventsAdapter.setEvents(events);
                    analysisProgress.setVisibility(ProgressBar.GONE);
                    updateStatus("Found " + events.size() + " noise events");
                });

            } catch (Exception e) {
                runOnUiThread(() -> {
                    analysisProgress.setVisibility(ProgressBar.GONE);
                    Toast.makeText(MainActivity.this, "Analysis error: " + e.getMessage(),
                            Toast.LENGTH_LONG).show();
                });
            }
        }).start();
    }

    private void playEvent(NoiseEvent event) {
        if (currentFile == null) {
            return;
        }

        try {
            audioPlayer.play(currentFile, event.getPlaybackStartMs(), event.getPlaybackEndMs());
            updateStatus("Playing event at " + formatTime(event.getStartTimeMs()));

            new Thread(() -> {
                while (audioPlayer.isPlaying()) {
                    try {
                        Thread.sleep(100);
                    } catch (InterruptedException e) {
                        break;
                    }
                }
                runOnUiThread(() -> updateStatus("Playback complete"));
            }).start();

        } catch (LineUnavailableException e) {
            Toast.makeText(this, "Playback error: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private void updateButtonStates(boolean recording) {
        recordButton.setEnabled(!recording);
        stopButton.setEnabled(recording);
        openButton.setEnabled(!recording);
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
