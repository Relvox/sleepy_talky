package com.sleepy.recorder.android;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Binder;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;

import com.sleepy.recorder.core.AudioConfig;
import com.sleepy.recorder.core.codec.OggOpusWriter;
import com.sleepy.recorder.core.codec.OpusEncoder;

import java.io.File;
import java.io.FileOutputStream;

/**
 * Foreground service for background audio recording
 */
public class RecordingService extends Service {
    private static final String CHANNEL_ID = "RecordingChannel";
    private static final int NOTIFICATION_ID = 1;

    private final IBinder binder = new RecordingBinder();
    private AndroidAudioRecorder recorder;
    private PowerManager.WakeLock wakeLock;
    private RecordingCallback callback;

    public class RecordingBinder extends Binder {
        RecordingService getService() {
            return RecordingService.this;
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();

        // Acquire wake lock
        PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
        wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "SleepyRecorder::Recording");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // Start foreground with notification
        Notification notification = createNotification("Recording...");
        startForeground(NOTIFICATION_ID, notification);

        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return binder;
    }

    @Override
    public void onDestroy() {
        if (recorder != null && recorder.isRecording()) {
            recorder.stopRecording();
        }

        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }

        super.onDestroy();
    }

    public void startRecording(File outputFile, RecordingCallback callback) {
        this.callback = callback;

        if (recorder == null) {
            recorder = new AndroidAudioRecorder();
        }

        try {
            wakeLock.acquire();

            recorder.startRecording(outputFile, new AndroidAudioRecorder.RecordingCallback() {
                @Override
                public void onAudioData(byte[] data, int length) {
                    if (RecordingService.this.callback != null) {
                        RecordingService.this.callback.onAudioData(data, length);
                    }
                }

                @Override
                public void onRecordingComplete(File file) {
                    if (RecordingService.this.callback != null) {
                        RecordingService.this.callback.onRecordingComplete(file);
                    }
                    stopForeground(true);
                    stopSelf();
                }

                @Override
                public void onError(Exception e) {
                    if (RecordingService.this.callback != null) {
                        RecordingService.this.callback.onError(e);
                    }
                    stopForeground(true);
                    stopSelf();
                }
            });

            updateNotification("Recording in progress");

        } catch (Exception e) {
            if (callback != null) {
                callback.onError(e);
            }
            stopForeground(true);
            stopSelf();
        }
    }

    public void stopRecording() {
        if (recorder != null) {
            recorder.stopRecording();
        }

        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
    }

    public boolean isRecording() {
        return recorder != null && recorder.isRecording();
    }

    private void createNotificationChannel() {
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Recording Service",
                NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Ongoing audio recording");

        NotificationManager manager = getSystemService(NotificationManager.class);
        manager.createNotificationChannel(channel);
    }

    private Notification createNotification(String text) {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this, 0, notificationIntent, PendingIntent.FLAG_IMMUTABLE
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Sleepy Recorder")
                .setContentText(text)
                .setSmallIcon(android.R.drawable.ic_btn_speak_now)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .build();
    }

    private void updateNotification(String text) {
        Notification notification = createNotification(text);
        NotificationManager manager = getSystemService(NotificationManager.class);
        manager.notify(NOTIFICATION_ID, notification);
    }

    public interface RecordingCallback {
        void onAudioData(byte[] data, int length);
        void onRecordingComplete(File file);
        void onError(Exception e);
    }
}
