package com.sleepy.recorder.android;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.sleepy.recorder.core.detection.NoiseEvent;

import java.util.List;
import java.util.Locale;

/**
 * RecyclerView adapter for displaying noise events
 */
public class EventsAdapter extends RecyclerView.Adapter<EventsAdapter.EventViewHolder> {
    private List<NoiseEvent> events;
    private final OnEventClickListener clickListener;

    public interface OnEventClickListener {
        void onEventClick(NoiseEvent event);
    }

    public EventsAdapter(List<NoiseEvent> events, OnEventClickListener clickListener) {
        this.events = events;
        this.clickListener = clickListener;
    }

    public void setEvents(List<NoiseEvent> events) {
        this.events = events;
        notifyDataSetChanged();
    }

    public void clearEvents() {
        this.events.clear();
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public EventViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.event_item, parent, false);
        return new EventViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull EventViewHolder holder, int position) {
        NoiseEvent event = events.get(position);
        holder.bind(event, clickListener);
    }

    @Override
    public int getItemCount() {
        return events.size();
    }

    static class EventViewHolder extends RecyclerView.ViewHolder {
        private final TextView eventText;

        EventViewHolder(@NonNull View itemView) {
            super(itemView);
            eventText = itemView.findViewById(R.id.eventText);
        }

        void bind(NoiseEvent event, OnEventClickListener listener) {
            String text = String.format(Locale.getDefault(),
                    "%s - %s (%.1fs, peak: %.2f)",
                    formatTime(event.getStartTimeMs()),
                    formatTime(event.getEndTimeMs()),
                    event.getDurationMs() / 1000.0,
                    event.getPeakVolume());

            eventText.setText(text);
            itemView.setOnClickListener(v -> listener.onEventClick(event));
        }

        private String formatTime(long milliseconds) {
            long seconds = milliseconds / 1000;
            long minutes = seconds / 60;
            seconds = seconds % 60;
            return String.format(Locale.getDefault(), "%d:%02d", minutes, seconds);
        }
    }
}
