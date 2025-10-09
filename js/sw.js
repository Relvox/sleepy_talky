// Service Worker for Sleepy Talky PWA
const CACHE_NAME = "sleepy-talky-v3";
const RUNTIME_CACHE = "sleepy-talky-runtime";

// Detect base path from service worker location
const getBasePath = () => {
  const swPath = self.location.pathname;
  const basePath = swPath.substring(0, swPath.lastIndexOf("/"));
  return basePath || "";
};

const BASE_PATH = getBasePath();

// Files to cache on install (relative to base path)
const STATIC_ASSETS = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/index.html`,
  `${BASE_PATH}/style.css`,
  `${BASE_PATH}/speech-bubble.png`,
  `${BASE_PATH}/favicon.ico`,
  `${BASE_PATH}/js/app.js`,
  `${BASE_PATH}/js/audio/recorder.js`,
  `${BASE_PATH}/js/audio/player.js`,
  `${BASE_PATH}/js/audio/ffmpegHelper.js`,
  `${BASE_PATH}/js/detection/audioAnalyzer.js`,
  `${BASE_PATH}/js/storage/recordingCache.js`,
  `${BASE_PATH}/js/ui/uiManager.js`,
  `${BASE_PATH}/js/visualizers/visualizationManager.js`,
  `${BASE_PATH}/js/visualizers/frequencyBands.js`,
  `${BASE_PATH}/js/visualizers/spectral.js`,
  `${BASE_PATH}/js/visualizers/eventsList.js`,
  `${BASE_PATH}/libs/ffmpeg/ffmpeg.js`,
  `${BASE_PATH}/libs/ffmpeg/ffmpeg-util.js`,
  `${BASE_PATH}/libs/ffmpeg/ffmpeg-core.js`,
  `${BASE_PATH}/libs/ffmpeg/ffmpeg-core.wasm`,
  `${BASE_PATH}/libs/ffmpeg/814.ffmpeg.js`,
];

// Install event - cache static assets
self.addEventListener("install", (event) => {
  console.log("[SW] Installing service worker...");
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("[SW] Caching static assets");
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log("[SW] Installation complete");
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error("[SW] Installation failed:", error);
      }),
  );
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating service worker...");
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
            .map((name) => {
              console.log("[SW] Deleting old cache:", name);
              return caches.delete(name);
            }),
        );
      })
      .then(() => {
        console.log("[SW] Activation complete");
        return self.clients.claim();
      }),
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Network-first for HTML (always fresh content)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(request);
        }),
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request)
        .then((response) => {
          // Don't cache non-successful responses
          if (
            !response ||
            response.status !== 200 ||
            response.type === "error"
          ) {
            return response;
          }

          const responseClone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });

          return response;
        })
        .catch(() => {
          // Offline fallback
          if (request.destination === "image") {
            return caches.match("/speech-bubble.png");
          }
        });
    }),
  );
});

// Handle messages from clients
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data && event.data.type === "CLEAR_CACHE") {
    event.waitUntil(
      caches
        .keys()
        .then((cacheNames) => {
          return Promise.all(cacheNames.map((name) => caches.delete(name)));
        })
        .then(() => {
          return self.clients.matchAll();
        })
        .then((clients) => {
          clients.forEach((client) => {
            client.postMessage({ type: "CACHE_CLEARED" });
          });
        }),
    );
  }
});
