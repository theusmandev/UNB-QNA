self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // A basic fetch handler to satisfy PWA install requirements.
  // We can add aggressive caching here later if needed.
  event.respondWith(fetch(event.request).catch(() => {
    // If offline, return a generic response or let it fail
    return new Response('You are offline.', { status: 503, statusText: 'Service Unavailable' });
  }));
});
