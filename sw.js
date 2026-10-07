/*
 * Dedida service worker — makes the web app installable and usable offline.
 * - Page (index.html): network first, falls back to the cached copy when offline.
 * - Everything else (JS bundle, fonts, images, audio): cache first. Files are content-hashed,
 *   so a cached file never goes stale. Images/audio are cached the first time they are shown,
 *   so words you have already studied keep working without internet.
 * Bump VERSION to force every user onto a fresh cache.
 */
const VERSION = 'dedida-v1';
const CORE = ['/', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((c) => c.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === '/sw.js') return;

  // App page: try the network so updates arrive, fall back to cache offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put('/', copy));
          }
          return res;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // Static files: cache first.
  event.respondWith(
    caches.match(req, { ignoreSearch: false }).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          // only full responses can be cached (audio range requests return 206)
          if (res.status === 200) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
    )
  );
});
