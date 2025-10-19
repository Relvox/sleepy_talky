package com.sleepy.recorder.desktop;

import com.sleepy.recorder.core.audio.AudioPlayer;
import com.sleepy.recorder.core.audio.AudioRecorder;
import com.sleepy.recorder.core.detection.AudioAnalyzer;
import com.sleepy.recorder.core.detection.NoiseEvent;
import java.io.File;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import javafx.application.Platform;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import javafx.fxml.FXML;
import javafx.scene.control.*;
import javafx.stage.FileChooser;
import javax.sound.sampled.LineUnavailableException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Main controller for desktop UI
 */
public class MainController {

    private static final Logger logger = LoggerFactory.getLogger(
        MainController.class
    );
    private static MainController instance;

    @FXML
    private Button recordButton;

    @FXML
    private Button stopButton;

    @FXML
    private Button saveButton;

    @FXML
    private Button discardButton;

    @FXML
    private Button openButton;

    @FXML
    private Button playButton;

    @FXML
    private Button stopPlayButton;

    @FXML
    private ListView<NoiseEvent> eventsListView;

    @FXML
    private ProgressBar analysisProgress;

    @FXML
    private Label statusLabel;

    private AudioRecorder recorder;
    private AudioPlayer player;
    private AudioAnalyzer analyzer;
    private File currentFile;
    private File tempRecordingFile;
    private ObservableList<NoiseEvent> events;

    public MainController() {
        instance = this;
    }

    public static MainController getInstance() {
        return instance;
    }

    @FXML
    public void initialize() {
        recorder = new AudioRecorder();
        player = new AudioPlayer();
        analyzer = new AudioAnalyzer();
        events = FXCollections.observableArrayList();

        eventsListView.setItems(events);
        eventsListView.setCellFactory(param -> new NoiseEventCell());

        // Set initial button states
        updateButtonStates(false, false, false);

        // Handle event selection for playback
        eventsListView
            .getSelectionModel()
            .selectedItemProperty()
            .addListener((obs, oldVal, newVal) -> {
                playButton.setDisable(newVal == null || player.isPlaying());
            });

        analysisProgress.setVisible(false);
    }

    @FXML
    private void handleRecord() {
        try {
            // Create temporary file for recording
            String timestamp = new SimpleDateFormat("yyyyMMdd_HHmmss").format(
                new Date()
            );
            tempRecordingFile = new File(
                System.getProperty("java.io.tmpdir"),
                "sleepy_temp_" + timestamp + ".ogg"
            );

            recorder.startRecording(
                tempRecordingFile,
                new AudioRecorder.RecordingCallback() {
                    @Override
                    public void onAudioData(byte[] data, int length) {
                        // Could add live visualization here
                    }

                    @Override
                    public void onRecordingComplete(File file) {
                        Platform.runLater(() -> {
                            updateStatus(
                                "Recording complete. Save or discard?"
                            );
                            updateButtonStates(false, false, true);
                            // Set temp file as current for analysis and playback
                            currentFile = file;
                            analyzeCurrentFile();
                        });
                    }

                    @Override
                    public void onError(Exception e) {
                        Platform.runLater(() -> {
                            showError("Recording error", e.getMessage());
                            updateButtonStates(false, false, false);
                            cleanupTempFile();
                        });
                    }
                }
            );

            updateStatus("Recording...");
            updateButtonStates(true, false, false);
        } catch (LineUnavailableException e) {
            showError(
                "Recording error",
                "Could not access microphone: " + e.getMessage()
            );
        }
    }

    @FXML
    private void handleStop() {
        recorder.stopRecording();
        updateStatus("Stopping recording...");
    }

    @FXML
    private void handleSave() {
        if (tempRecordingFile == null || !tempRecordingFile.exists()) {
            showError("Save error", "No recording to save");
            return;
        }

        // Show save dialog
        FileChooser fileChooser = new FileChooser();
        fileChooser.setTitle("Save Recording");

        // Generate default filename with timestamp
        String timestamp = new SimpleDateFormat("yyyyMMdd_HHmmss").format(
            new Date()
        );
        fileChooser.setInitialFileName("recording_" + timestamp + ".ogg");

        // Set file extension filter
        fileChooser
            .getExtensionFilters()
            .add(new FileChooser.ExtensionFilter("Ogg Opus Audio", "*.ogg"));

        File savedFile = fileChooser.showSaveDialog(
            saveButton.getScene().getWindow()
        );

        if (savedFile == null) {
            return; // User cancelled
        }

        try {
            // Move temp file to final location
            java.nio.file.Files.move(
                tempRecordingFile.toPath(),
                savedFile.toPath(),
                java.nio.file.StandardCopyOption.REPLACE_EXISTING
            );

            currentFile = savedFile;
            tempRecordingFile = null;

            updateStatus("Recording saved: " + savedFile.getName());
            updateButtonStates(false, false, false);
        } catch (Exception e) {
            showError(
                "Save error",
                "Failed to save recording: " + e.getMessage()
            );
        }
    }

    @FXML
    private void handleDiscard() {
        if (tempRecordingFile == null) {
            return;
        }

        Alert confirm = new Alert(Alert.AlertType.CONFIRMATION);
        confirm.setTitle("Discard Recording");
        confirm.setHeaderText("Are you sure?");
        confirm.setContentText("This will permanently delete the recording.");

        if (confirm.showAndWait().orElse(ButtonType.CANCEL) == ButtonType.OK) {
            cleanupTempFile();
            currentFile = null;
            events.clear();
            updateStatus("Recording discarded");
            updateButtonStates(false, false, false);
        }
    }

    @FXML
    private void handleOpen() {
        FileChooser fileChooser = new FileChooser();
        fileChooser.setTitle("Open Audio File");
        fileChooser
            .getExtensionFilters()
            .addAll(
                new FileChooser.ExtensionFilter(
                    "Supported Audio Files",
                    "*.wav",
                    "*.ogg",
                    "*.opus"
                ),
                new FileChooser.ExtensionFilter("WAV Audio", "*.wav"),
                new FileChooser.ExtensionFilter("OGG Vorbis", "*.ogg"),
                new FileChooser.ExtensionFilter("Opus Audio", "*.opus")
            );

        File file = fileChooser.showOpenDialog(
            openButton.getScene().getWindow()
        );
        if (file != null && file.exists()) {
            currentFile = file;
            updateStatus("Opened: " + file.getName());
            analyzeCurrentFile();
        }
    }

    @FXML
    private void handlePlay() {
        NoiseEvent selectedEvent = eventsListView
            .getSelectionModel()
            .getSelectedItem();
        if (selectedEvent == null || currentFile == null) {
            return;
        }

        try {
            player.play(
                currentFile,
                selectedEvent.getPlaybackStartMs(),
                selectedEvent.getPlaybackEndMs()
            );

            updateStatus(
                "Playing event at " + formatTime(selectedEvent.getStartTimeMs())
            );
            playButton.setDisable(true);
            stopPlayButton.setDisable(false);

            // Start a thread to monitor playback completion
            new Thread(() -> {
                while (player.isPlaying()) {
                    try {
                        Thread.sleep(100);
                    } catch (InterruptedException e) {
                        break;
                    }
                }
                Platform.runLater(() -> {
                    playButton.setDisable(false);
                    stopPlayButton.setDisable(true);
                    updateStatus("Playback complete");
                });
            })
                .start();
        } catch (LineUnavailableException e) {
            showError(
                "Playback error",
                "Could not access audio output: " + e.getMessage()
            );
        }
    }

    @FXML
    private void handleStopPlay() {
        player.stop();
        playButton.setDisable(false);
        stopPlayButton.setDisable(true);
        updateStatus("Playback stopped");
    }

    private void analyzeCurrentFile() {
        if (currentFile == null) {
            return;
        }

        // Check if file format is supported before attempting analysis
        String fileName = currentFile.getName().toLowerCase();
        if (fileName.endsWith(".m4a")) {
            showError(
                "Unsupported Format",
                "M4A files are not supported.\n\n" +
                    "Please convert to WAV or OGG Vorbis format.\n" +
                    "You can use ffmpeg: ffmpeg -i input.m4a output.ogg"
            );
            return;
        }
        if (fileName.endsWith(".mp3")) {
            showError(
                "Unsupported Format",
                "MP3 files are not reliably supported.\n\n" +
                    "Please convert to WAV or OGG Vorbis format.\n" +
                    "You can use ffmpeg: ffmpeg -i input.mp3 output.ogg"
            );
            return;
        }

        events.clear();
        analysisProgress.setVisible(true);
        analysisProgress.setProgress(0);
        updateStatus("Analyzing audio...");

        // Run analysis in background thread
        new Thread(() -> {
            try {
                List<NoiseEvent> detectedEvents = analyzer.analyzeFile(
                    currentFile,
                    progress -> {
                        Platform.runLater(() ->
                            analysisProgress.setProgress(progress)
                        );
                    }
                );

                Platform.runLater(() -> {
                    events.addAll(detectedEvents);
                    analysisProgress.setVisible(false);
                    updateStatus(
                        "Found " + detectedEvents.size() + " noise events"
                    );
                });
            } catch (Exception e) {
                logger.error(
                    "FATAL: Analysis failed for file: {}",
                    currentFile.getName(),
                    e
                );
                logger.error("Exception type: {}", e.getClass().getName());
                logger.error("Exception message: {}", e.getMessage());
                if (e.getCause() != null) {
                    logger.error(
                        "Caused by: {} - {}",
                        e.getCause().getClass().getName(),
                        e.getCause().getMessage()
                    );
                }
                e.printStackTrace(); // Also print to console

                Platform.runLater(() -> {
                    analysisProgress.setVisible(false);
                    String errorMsg = e.getMessage() != null
                        ? e.getMessage()
                        : e.getClass().getSimpleName();

                    // Provide helpful messages for common errors
                    String userMessage = errorMsg;
                    if (errorMsg.contains("Resetting to invalid mark")) {
                        userMessage =
                            "M4A format not supported.\n\n" +
                            "The Java Sound libraries cannot decode this M4A file.\n" +
                            "Try converting to OGG Vorbis, WAV, or Opus format.";
                    } else if (
                        errorMsg.contains("ArrayIndexOutOfBoundsException") ||
                        errorMsg.contains("Index 1 out of bounds")
                    ) {
                        userMessage =
                            "MP3 decoding error.\n\n" +
                            "This MP3 file has stereo-to-mono conversion issues.\n" +
                            "Try converting to OGG Vorbis, WAV, or Opus format.";
                    } else if (errorMsg.contains("Unsupported audio format")) {
                        userMessage =
                            "Unsupported audio format.\n\n" +
                            "Supported formats: Opus (.opus), OGG Vorbis (.ogg), WAV (.wav)\n" +
                            "MP3 and M4A have limited support due to decoder limitations.";
                    }

                    showError(
                        "Analysis error",
                        userMessage +
                            "\n\nCheck console/logs for technical details."
                    );
                });
            }
        })
            .start();
    }

    private void updateButtonStates(
        boolean recording,
        boolean playing,
        boolean hasUnsavedRecording
    ) {
        recordButton.setDisable(recording || hasUnsavedRecording);
        stopButton.setDisable(!recording);
        saveButton.setDisable(!hasUnsavedRecording);
        discardButton.setDisable(!hasUnsavedRecording);
        openButton.setDisable(recording || hasUnsavedRecording);
        stopPlayButton.setDisable(!playing);
    }

    private void cleanupTempFile() {
        if (tempRecordingFile != null && tempRecordingFile.exists()) {
            tempRecordingFile.delete();
            tempRecordingFile = null;
        }
    }

    private void updateStatus(String message) {
        statusLabel.setText(message);
    }

    private void showError(String title, String message) {
        Alert alert = new Alert(Alert.AlertType.ERROR);
        alert.setTitle(title);
        alert.setHeaderText(null);
        alert.setContentText(message);
        alert.showAndWait();
    }

    private String formatTime(long milliseconds) {
        long seconds = milliseconds / 1000;
        long minutes = seconds / 60;
        seconds = seconds % 60;
        return String.format("%d:%02d", minutes, seconds);
    }

    public void cleanup() {
        if (recorder != null && recorder.isRecording()) {
            recorder.stopRecording();
        }
        if (player != null && player.isPlaying()) {
            player.stop();
        }
        cleanupTempFile();
    }

    /**
     * Custom cell for displaying noise events
     */
    private class NoiseEventCell extends ListCell<NoiseEvent> {

        @Override
        protected void updateItem(NoiseEvent event, boolean empty) {
            super.updateItem(event, empty);

            if (empty || event == null) {
                setText(null);
            } else {
                setText(
                    String.format(
                        "%s - %s (%.1fs, peak: %.2f)",
                        formatTime(event.getStartTimeMs()),
                        formatTime(event.getEndTimeMs()),
                        event.getDurationMs() / 1000.0,
                        event.getPeakVolume()
                    )
                );
            }
        }
    }
}
