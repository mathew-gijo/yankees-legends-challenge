// Minimal service worker: cache the app shell for offline load; always fetch
// fresh content JSON and live photos from the network.

const CACHE = 'ylc-shell-v2';
const SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/ui.js',
  './js/content.js',
  './js/net.js',
  './js/game.js',
  './js/screens.js',
  './js/firebase-config.js',
  './manifest.webmanifest',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

// Network-first for same-origin requests: always try the network so code and
// content stay fresh ("dynamically updates from the internet"), and fall back
// to the cached copy only when offline. Cross-origin (Wikipedia photos,
// Firebase) goes straight to the network, untouched.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
