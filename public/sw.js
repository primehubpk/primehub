// PrimeHubMall PWA service worker.
// Only static/app-shell assets are cached. Live HTML, APIs, cart, checkout,
// orders, account data and price-bearing responses always stay network-driven.
const VERSION = 'primehub-pwa-v7';
const SHELL_CACHE = `${VERSION}-shell`;
const STATIC_CACHE = `${VERSION}-static`;
const IMAGE_CACHE = `${VERSION}-images`;
const PAGE_CACHE = `${VERSION}-pages`;
const PRIMEHUB_CACHES = [SHELL_CACHE, STATIC_CACHE, IMAGE_CACHE, PAGE_CACHE];
const TRUSTED_IMAGE_ORIGINS = new Set([
  self.location.origin,
  'https://images.primehubmall.com',
  'https://pub-157b90419bf04016bdea666e4cbce181.r2.dev',
  'https://i.ibb.co',
]);
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
  // Never persist opaque responses. Cross-origin image failures are opaque too,
  // so caching them can permanently turn a temporary CDN error into a broken card.
  if (!response || !response.ok) return response;
  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
    if (maxEntries) await trimCache(cacheName, maxEntries);
  } catch {
    // Private browsing/storage quota failures must not discard a good network
    // response. Persistence is optional; displaying the asset is not.
  }
  return response;
}

async function cacheFirst(request) {
  const cached = await caches.match(request).catch(() => undefined);
  if (cached) return cached;
  const response = await fetch(request);
  return cacheResponse(STATIC_CACHE, request, response, 120);
}

async function imageCacheFirst(request) {
  const cached = await caches.match(request).catch(() => undefined);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    return await cacheResponse(IMAGE_CACHE, request, response, 180);
  } catch {
    return Response.error();
  }
}

function isPrivatePage(pathname) {
  return (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/checkout') ||
    pathname.startsWith('/cart') ||
    pathname.startsWith('/account') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/orders') ||
    pathname.startsWith('/wallet') ||
    pathname.startsWith('/reseller') ||
    pathname.startsWith('/auth')
  );
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

function rememberPage(cache, request, response) {
  if (!response || !response.ok || response.type !== 'basic' || response.redirected) return Promise.resolve();
  const cacheControl = response.headers.get('cache-control') || '';
  if (/private|no-store/i.test(cacheControl)) return Promise.resolve();
  return cache.put(request, response.clone()).then(() => trimCache(PAGE_CACHE, 12));
}

// Repeat app opens paint the last page immediately, then refresh that copy in
// the background. This is the same one navigation request as before, not an
// extra catalog read.
async function staleWhileRevalidateNavigation(event) {
  const cache = await caches.open(PAGE_CACHE);
  const cached = await cache.match(event.request);
  const update = (async () => {
    const preloaded = await event.preloadResponse;
    const response = preloaded || await fetch(event.request);
    await rememberPage(cache, event.request, response);
    return response;
  })().catch(async () => cached || (await caches.match('/offline.html')) || Response.error());
  if (cached) {
    event.waitUntil(update.then(() => undefined));
    return cached;
  }
  return update;
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
  const isSameOrigin = url.origin === self.location.origin;
  const isOptimizedImage = isSameOrigin && url.pathname === '/_next/image';
  const isImage =
    request.destination === 'image' ||
    /\.(?:png|jpe?g|webp|avif|gif|svg|ico)$/i.test(url.pathname);

  // Cross-origin R2/IBB image responses are normally opaque to a service worker.
  // An opaque 404/5xx looks identical to a successful image, so putting it in
  // CacheStorage can poison that product image until the worker cache is cleared.
  // Let the browser/CDN HTTP cache handle remote images; only cache verifiable
  // same-origin images here. This also avoids duplicate persistent image caches.
  if ((isOptimizedImage || isImage) && TRUSTED_IMAGE_ORIGINS.has(url.origin)) {
    if (!isSameOrigin) return;
    event.respondWith(imageCacheFirst(request));
    return;
  }

  if (!isSameOrigin) return;

  // Never intercept customer/business data endpoints.
  if (url.pathname.startsWith('/api/')) return;

  // Account, cart, checkout and admin stay network-only. Public storefront
  // pages paint from the last visit, then refresh once in the background.
  if (request.mode === 'navigate') {
    if (
      request.headers.get('RSC') ||
      request.headers.get('Next-Router-Prefetch') ||
      request.headers.get('Next-Router-Segment-Prefetch') ||
      isPrivatePage(url.pathname)
    ) {
      event.respondWith(networkNavigation(event));
      return;
    }
    event.respondWith(staleWhileRevalidateNavigation(event));
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
  }
});
