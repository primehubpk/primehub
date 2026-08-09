// PrimeHub Deals PWA service worker.
// Intentionally does not intercept fetch requests yet. This keeps Firebase,
// ImgBB, checkout and other live functionality untouched while providing the
// service-worker foundation for future offline caching.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
