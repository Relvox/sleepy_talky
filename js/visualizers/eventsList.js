// Events list visualizer - simple list, no canvas
export class EventsListVisualizer {
  constructor(container) {
    this.container = container;
    this.events = [];
    this.playingEventIndex = null;
  }

  update(events, duration) {
    this.events = events || [];
    this.duration = duration;
  }

  updatePlayingEvent(index) {
    this.playingEventIndex = index;
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, "0")}`;
  }

  clear() {
    if (this.container) {
      this.container.innerHTML = "";
    }
    this.events = [];
    this.playingEventIndex = null;
  }

  // Create interactive list in container
  renderEventsList(events, onPlayEvent) {
    if (!this.container) {
      console.warn("[EventsList] Container element not found");
      return;
    }

    // Store events for later reference
    this.events = events || [];

    this.container.innerHTML = "";

    if (!events || events.length === 0) {
      this.container.innerHTML =
        '<div style="color: #888; padding: 20px;">No noise events detected</div>';
      return;
    }

    const listContainer = document.createElement("div");
    listContainer.style.cssText = `
      max-height: 400px;
      overflow-y: auto;
      padding: 10px;
    `;

    events.forEach((event, index) => {
      const isPlaying = this.playingEventIndex === index;
      const eventDiv = document.createElement("div");
      eventDiv.className = "event-item";
      eventDiv.dataset.eventIndex = index;

      // Style based on playing state
      eventDiv.style.cssText = `
        background: ${isPlaying ? "#3498db" : "#2c3e50"};
        padding: 12px;
        margin: 5px 0;
        border-radius: 4px;
        cursor: pointer;
        transition: background 0.2s;
        border-left: 4px solid ${isPlaying ? "#95e1d3" : "transparent"};
      `;

      eventDiv.onmouseenter = () => {
        if (!isPlaying) eventDiv.style.background = "#34495e";
      };
      eventDiv.onmouseleave = () => {
        eventDiv.style.background = isPlaying ? "#3498db" : "#2c3e50";
      };

      eventDiv.onclick = () => {
        onPlayEvent(event, index);
      };

      const startTime = this.formatTime(event.startTime / 1000);
      const duration = this.formatTime(
        (event.endTime - event.startTime) / 1000,
      );
      const peakDb = event.peakVolume.toFixed(1);
      const icon = isPlaying ? "⏸️" : "▶️";
      const statusText = isPlaying
        ? '<span style="color: #95e1d3; font-size: 11px; margin-left: 8px;">● PLAYING</span>'
        : "";

      eventDiv.innerHTML = `
        <div style="font-weight: bold; color: #fff;">${icon} Event ${index + 1}${statusText}</div>
        <div style="color: #aaa; font-size: 12px; margin-top: 5px;">
          Start: ${startTime} • Duration: ${duration} • Peak: ${peakDb} dB
        </div>
      `;

      listContainer.appendChild(eventDiv);
    });

    this.container.appendChild(listContainer);
  }
}
