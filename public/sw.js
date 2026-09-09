// PrimeHubMall PWA service worker.
// Only static/app-shell assets are cached. Live HTML, APIs, cart, checkout,
// orders, account data and price-bearing responses always stay network-driven.
const VERSION = 'primehub-pwa-v2';
const SHELL_CACHE = `${VERSION}-shell`;
const STATIC_CACHE = `${VERSION}-static`;
const IMAGE_CACHE = `${VERSION}-images`;
const PRIMEHUB_CACHES = [SHELL_CACHE, STATIC_CACHE, IMAGE_CACHE];
const SHELL_ASSETS = [
  '/offline.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  const overflow = keys.length - maxEntries;
  if (overflow <= 0) return;
  await Promise.all(keys.slice(0, overflow).map((request) => cache.delete(request)));
}

async function cacheResponse(cacheName, request, response, maxEntries) {
  if (!response || !response.ok || response.type === 'opaque') return response;
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
  if (maxEntries) await trimCache(cacheName, maxEntries);
  return response;
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  return cacheResponse(STATIC_CACHE, request, response, 120);
}

async function imageStaleWhileRevalidate(event) {
  const request = event.request;
  const cached = await caches.match(request);
  const network = fetch(request)
    .then((response) => cacheResponse(IMAGE_CACHE, request, response, 80))
    .catch(() => null);

  if (cached) {
    event.waitUntil(network);
    return cached;
  }

  const response = await network;
  return response || Response.error();
}

async function networkNavigation(event) {
  try {
    const preloaded = await event.preloadResponse;
    if (preloaded) return preloaded;
    return await fetch(event.request);
  } catch {
    return (await caches.match('/offline.html')) || Response.error();
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await Promise.allSettled(
      SHELL_ASSETS.map((asset) => cache.add(new Request(asset, { cache: 'reload' }))),
    );
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((name) => name.startsWith('primehub-pwa-') && !PRIMEHUB_CACHES.includes(name))
        .map((name) => caches.delete(name)),
    );
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.enable(); } catch {}
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept customer/business data endpoints.
  if (url.pathname.startsWith('/api/')) return;

  // Documents stay network-only so live product/deal prices, cart/order/account
  // state and admin-driven content are never served from an offline page cache.
  if (request.mode === 'navigate') {
    event.respondWith(networkNavigation(event));
    return;
  }

  const isNextStatic = url.pathname.startsWith('/_next/static/');
  const isCoreShellAsset =
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.webmanifest' ||
    url.pathname === '/favicon.ico';
  const isStaticDestination = ['script', 'style', 'font'].includes(request.destination);

  if (isNextStatic || isCoreShellAsset || isStaticDestination) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Optimized/product imagery is safe to cache because it contains no price,
  // stock, cart, order or account state. Limit entries so storage cannot grow forever.
  const isOptimizedImage = url.pathname === '/_next/image';
  const isImage = request.destination === 'image' || /\.(?:png|jpe?g|webp|avif|gif|svg|ico)$/i.test(url.pathname);
  if (isOptimizedImage || isImage) {
    event.respondWith(imageStaleWhileRevalidate(event));
  }
});
