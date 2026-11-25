import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { fetchPublicStorefront, invalidatePublicStorefront } from '../lib/storefrontClient.ts';

const originalFetch = globalThis.fetch;
const originalNow = Date.now;
afterEach(() => {
  globalThis.fetch = originalFetch;
  Date.now = originalNow;
  invalidatePublicStorefront();
});

test('20 concurrent public readers share one request and independently readable bodies', async () => {
  invalidatePublicStorefront();
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ products: [{ id: 'one' }] }); };
  const responses = await Promise.all(Array.from({ length: 20 }, () => fetchPublicStorefront('catalog')));
  const bodies = await Promise.all(responses.map(response => response.json()));
  assert.equal(calls, 1);
  assert.ok(bodies.every(body => body.products[0].id === 'one'));
  assert.deepEqual(await (await fetchPublicStorefront('catalog')).json(), bodies[0]);
  assert.equal(calls, 1);
});

test('a public snapshot expires without caching private reads', async () => {
  invalidatePublicStorefront();
  let now = 1000;
  Date.now = () => now;
  let calls = 0;
  globalThis.fetch = async () => Response.json({ version: ++calls });
  await fetchPublicStorefront('settings');
  now += 60_001;
  assert.equal((await (await fetchPublicStorefront('settings')).json()).version, 2);
});

test('failed requests are retried and never saved as successful data', async () => {
  invalidatePublicStorefront();
  let calls = 0;
  globalThis.fetch = async () => ++calls === 1 ? new Response('Unavailable', { status: 503 }) : Response.json({ gifts: [] });
  assert.equal((await fetchPublicStorefront('rewards')).status, 503);
  assert.equal((await fetchPublicStorefront('rewards')).status, 200);
  assert.equal(calls, 2);
});

test('an admin invalidation defeats a late response from before the write', async () => {
  invalidatePublicStorefront();
  let finishOld;
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    if (calls === 1) return new Promise(resolve => { finishOld = resolve; });
    assert.match(url, /refresh=1/);
    assert.equal(options.cache, 'no-store');
    return Response.json({ version: 'new' });
  };
  const old = fetchPublicStorefront('settings');
  invalidatePublicStorefront('settings');
  assert.equal((await (await fetchPublicStorefront('settings')).json()).version, 'new');
  finishOld(Response.json({ version: 'old' }));
  await old;
  assert.equal((await (await fetchPublicStorefront('settings')).json()).version, 'new');
  assert.equal(calls, 2);
});

test('ordinary expired public reads allow HTTP caching instead of forcing an origin refresh', async () => {
  invalidatePublicStorefront();
  let now = 1000;
  Date.now = () => now;
  const modes = [];
  globalThis.fetch = async (_url, options) => {
    modes.push(options.cache);
    return Response.json({ documents: { main: {} } });
  };
  await fetchPublicStorefront('settings');
  now += 60_001;
  await fetchPublicStorefront('settings');
  assert.deepEqual(modes, ['no-store', 'default']);
});

test('PWA always retrieves fresh online HTML and deletes previous deployment page caches', async () => {
  const code = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
  const events = new Map();
  const deletedCaches = [];
  let cacheMatchCalled = false;
  let observedRequest = null;
  const stalePage = new Response('OLD BIG DEAL PAGE', { status: 200 });
  const context = {
    URL, Request, Response, Promise, Set, console,
    self: {
      location: { origin: 'https://www.primehubmall.com' },
      addEventListener: (name, callback) => events.set(name, callback),
      skipWaiting: async () => {},
      clients: { claim: async () => {} },
      registration: { navigationPreload: { disable: async () => {} } },
    },
    caches: {
      keys: async () => ['primehub-pwa-v7-pages', 'primehub-pwa-v7-static', 'primehub-pwa-v8-shell', 'primehub-pwa-v9-shell'],
      delete: async (name) => { deletedCaches.push(name); return true; },
      match: async (request) => {
        cacheMatchCalled = true;
        return request === '/offline.html' ? new Response('OFFLINE') : stalePage;
      },
      open: async () => ({ add: async () => {} }),
    },
    fetch: async (request, options) => {
      observedRequest = { url: request.url, cache: options?.cache };
      return new Response('CURRENT MEGA AND BOGO PAGE', { status: 200 });
    },
  };

  runInNewContext(code, context, { filename: 'public/sw.js' });
  const activation = { waitUntil(promise) { this.completion = promise; } };
  events.get('activate')(activation);
  await activation.completion;
  assert.deepEqual(deletedCaches.sort(), ['primehub-pwa-v7-pages', 'primehub-pwa-v7-static', 'primehub-pwa-v8-shell']);

  const navigation = {
    request: {
      url: 'https://www.primehubmall.com/',
      method: 'GET',
      mode: 'navigate',
      destination: 'document',
      headers: { get: () => null },
    },
    preloadResponse: Promise.resolve(new Response('STALE PRELOAD')),
    respondWith(promise) { this.result = promise; },
  };
  events.get('fetch')(navigation);
  assert.equal(await (await navigation.result).text(), 'CURRENT MEGA AND BOGO PAGE');
  assert.deepEqual(observedRequest, { url: 'https://www.primehubmall.com/', cache: 'no-store' });
  assert.equal(cacheMatchCalled, false, 'live online navigation must not read stale cache');

  context.fetch = async () => { throw new Error('Offline'); };
  const offline = { ...navigation, respondWith(promise) { this.result = promise; } };
  events.get('fetch')(offline);
  assert.equal(await (await offline.result).text(), 'OFFLINE');
  assert.equal(cacheMatchCalled, true, 'only the offline static shell is read when disconnected');
});
