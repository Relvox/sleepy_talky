// Constants for events list visualization
const BACKGROUND_COLOR = "#1a1a1a";
const EVENT_BAR_COLOR = "#ff6b6b";
const TIMELINE_COLOR = "#4ecdc4";
const TEXT_COLOR = "#ffffff";
const FONT_STYLE = "12px monospace";
const TIMELINE_HEIGHT = 40;
const EVENT_HEIGHT = 20;
const PADDING = 10;

export class EventsListVisualizer {
  constructor(canvas, container) {
    this.canvas = canvas;
    this.container = container;
    this.ctx = canvas.getContext("2d");
    this.events = [];
    this.duration = 0;
    this.onEventClick = null;
  }

  update(events, duration) {
    this.events = events || [];
    this.duration = duration;
    this.draw();
  }

  draw() {
    this.ctx.fillStyle = BACKGROUND_COLOR;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    if (!this.events.length || !this.duration) {
      this.ctx.fillStyle = TEXT_COLOR;
      this.ctx.font = FONT_STYLE;
      this.ctx.fillText("No noise events detected", PADDING, 30);
      return;
    }

    // Draw timeline
    this.drawTimeline();

    // Draw events
    this.events.forEach((event, index) => {
      this.drawEvent(event, index);
    });

    // Draw event count
    this.ctx.fillStyle = TEXT_COLOR;
    this.ctx.font = FONT_STYLE;
    this.ctx.fillText(
      `${this.events.length} noise event${this.events.length !== 1 ? 's' : ''} detected`,
      PADDING,
      this.canvas.height - PADDING
    );
  }

  drawTimeline() {
    const y = TIMELINE_HEIGHT;
    const width = this.canvas.width - 2 * PADDING;

    // Timeline bar
    this.ctx.strokeStyle = TIMELINE_COLOR;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(PADDING, y);
    this.ctx.lineTo(PADDING + width, y);
    this.ctx.stroke();

    // Time markers
    this.ctx.fillStyle = TEXT_COLOR;
    this.ctx.font = FONT_STYLE;
    this.ctx.fillText("0:00", PADDING, y - 5);
    this.ctx.fillText(
      this.formatTime(this.duration / 1000),
      PADDING + width - 40,
      y - 5
    );
  }

  drawEvent(event, index) {
    const width = this.canvas.width - 2 * PADDING;
    const startX = PADDING + (event.startTime / this.duration) * width;
    const endX = PADDING + (event.endTime / this.duration) * width;
    const eventWidth = Math.max(endX - startX, 2);
    const y = TIMELINE_HEIGHT + 30 + index * 30;

    // Event bar on timeline
    this.ctx.fillStyle = EVENT_BAR_COLOR;
    this.ctx.fillRect(startX, TIMELINE_HEIGHT - 10, eventWidth, EVENT_HEIGHT);

    // Event details
    this.ctx.fillStyle = TEXT_COLOR;
    this.ctx.font = FONT_STYLE;
    const startTime = this.formatTime(event.startTime / 1000);
    const duration = this.formatTime((event.endTime - event.startTime) / 1000);
    const peakDb = event.peakVolume.toFixed(1);
    this.ctx.fillText(
      `Event ${index + 1}: ${startTime} | Duration: ${duration} | Peak: ${peakDb} dB`,
      PADDING,
      y
    );
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, "0")}`;
  }

  clear() {
    this.ctx.fillStyle = BACKGROUND_COLOR;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.events = [];
  }

  // Create interactive list in container
  renderEventsList(events, onPlayEvent) {
    this.container.innerHTML = "";

    if (!events || events.length === 0) {
      this.container.innerHTML = '<div style="color: #888; padding: 20px;">No noise events detected</div>';
      return;
    }

    const listContainer = document.createElement("div");
    listContainer.style.cssText = `
      max-height: 300px;
      overflow-y: auto;
      padding: 10px;
    `;

    events.forEach((event, index) => {
      const eventDiv = document.createElement("div");
      eventDiv.style.cssText = `
        background: #2c3e50;
        padding: 10px;
        margin: 5px 0;
        border-radius: 4px;
        cursor: pointer;
        transition: background 0.2s;
      `;
      eventDiv.onmouseenter = () => eventDiv.style.background = "#34495e";
      eventDiv.onmouseleave = () => eventDiv.style.background = "#2c3e50";
      eventDiv.onclick = () => onPlayEvent(event, index);

      const startTime = this.formatTime(event.startTime / 1000);
      const duration = this.formatTime((event.endTime - event.startTime) / 1000);
      const peakDb = event.peakVolume.toFixed(1);

      eventDiv.innerHTML = `
        <div style="font-weight: bold; color: #fff;">▶️ Event ${index + 1}</div>
        <div style="color: #aaa; font-size: 12px; margin-top: 5px;">
          ${startTime} • ${duration} • Peak: ${peakDb} dB
        </div>
      `;

      listContainer.appendChild(eventDiv);
    });

    this.container.appendChild(listContainer);
  }
}
