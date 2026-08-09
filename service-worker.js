const CACHE_NAME = 'sahnoun-institute-v5';

// Install: clear ALL old caches immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.map((name) => {
        if (name !== CACHE_NAME) {
          console.log('SW deleting old cache:', name);
          return caches.delete(name);
        }
      }))
    ).then(() => self.skipWaiting())
  );
});

// Activate: claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.map((name) => {
        if (name !== CACHE_NAME) {
          return caches.delete(name);
        }
      }))
    ).then(() => self.clients.claim())
  );
});

// Fetch: always network-first, cache only as fallback for offline
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and Firebase/Google APIs
  if (request.method !== 'GET') return;
  if (url.origin.includes('googleapis.com') ||
      url.origin.includes('gstatic.com') ||
      url.origin.includes('firebase')) {
    return;
  }

  event.respondWith(
    fetch(request, { cache: 'no-store' })
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          if (request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
