// IndexedDB storage for recordings
const DB_NAME = "SleepRecorderDB";
const DB_VERSION = 1;
const STORE_NAME = "recordings";

export class RecordingCache {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("timestamp", "timestamp", { unique: false });
        }
      };
    });
  }

  async saveRecording(blob, mimeType, events = []) {
    if (!this.db) await this.init();

    const recording = {
      id: "latest", // Always overwrite with latest
      timestamp: Date.now(),
      blob: blob,
      mimeType: mimeType,
      events: events,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(recording);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getLatestRecording() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get("latest");

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async clearRecording() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete("latest");

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
