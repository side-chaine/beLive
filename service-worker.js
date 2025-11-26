const CACHE_NAME = 'belive-cache-v1';
const urlsToCache = [
  './', // Главная страница
  './index.html',
  './css/styles.css',
  './css/transport-controls.css',
  './css/karaoke-styles.css',
  './css/block-type-markers.css',
  './css/live-mode.css',
  './css/mode-buttons-override.css',
  './css/font-selector.css',
  './css/waveform-source-switcher.css',
  './css/avatar-page.css',
  './css/home-button-enhanced.css',
  './css/bmp-styles.css',
  './css/catalog-v2.css',
  './css/dark-overlay.css',
  './css/rehearsal-styles.css',
  './css/concert-styles.css',
  './css/conveyor-styles.css',
  './css/loop-button-styles.css',
  './js/dev-flags.js',
  './js/debug-config.js',
  './js/overlay.js',
  './js/utils.js',
  './js/state-manager.js',
  './js/view-manager.js',
  './js/constants.js',
  './js/logger.js',
  './js/audio-source-adapter.js',
  './js/color-service.js',
  './js/audio-engine.js',
  './js/enhanced-rtf-processor.js',
  './js/rtf-parser.js',
  './js/rtf-simple-parser.js?v=2025-11-18',
  './js/rtf-parser-adapter.js?v=2025-11-18',
  './js/lyrics-display.js',
  './js/enhanced-text-processor.js?v=2025-11-18',
  './js/text-processor-integrator.js',
  './js/track-catalog.js',
  './js/marker-manager.js',
  './js/waveform-editor.js',
  './js/text-style-manager.js',
  './js/drag-boundary-controller.js',
  './js/block-loop-control.js',
  './js/audio-exporter.js',
  './js/export-ui.js',
  './js/background-effects-engine.js',
  './js/mask-system.js',
  './js/rtf-parser-integration.js',
  './js/modal-block-editor.js',
  './js/piano-keyboard.js',
  './js/karaoke-background.js',
  './js/rehearsal-background.js',
  './js/concert-background.js',
  './js/monitor-mix.js',
  './js/monitor-ui.js',
  './js/live-mode.js',
  './js/live-feed.js',
  './js/catalog-v2.js?v=2.0',
  './js/app.js',
  './src/main.ts', // Теперь отдается как JS
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://cdn.jsdelivr.net/npm/rtf.js@0.4.0/dist/rtf.min.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/control_utils/control_utils.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/face_detection.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/holistic/holistic.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js',
  'https://esm.sh/pitchy@4',
  'https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&family=Montserrat:wght@400;700&family=Open+Sans:wght@400;700&family=Bebas+Neue&family=Playfair+Display:wght@400;700&family=Merriweather:wght@400;700&family=Lora:wght@400;700&family=PT+Serif:wght@400;700&family=Oswald:wght@400;700&family=Lobster&family=Pacifico&family=Caveat&display=swap',
  'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;900&display=swap',
  // Placeholder icons (need to be created)
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
];

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing Service Worker ...', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('[Service Worker] Cache addAll failed:', error);
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          console.log('[Service Worker] Found in cache:', event.request.url);
          return response;
        }
        console.log('[Service Worker] Network request:', event.request.url);
        return fetch(event.request);
      })
      .catch(error => {
        console.error('[Service Worker] Fetch failed:', error);
      })
  );
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating Service Worker ....', CACHE_NAME);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
