import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import { storefrontImageRecoveryScript } from '../lib/storefrontImageRecovery.ts';

const custom = 'https://images.primehubmall.com';
const legacy = 'https://pub-157b90419bf04016bdea666e4cbce181.r2.dev';

function recovery() {
  let listener;
  class Img {
    constructor(src) { this.src = src; this.srcset = 'old'; }
    get currentSrc() { return this.src; }
    removeAttribute(name) { delete this[name]; }
  }
  vm.runInNewContext(storefrontImageRecoveryScript, {
    URL, WeakMap, Set, Array, HTMLImageElement: Img,
    window: { addEventListener: (name, callback, capture) => {
      assert.equal(name, 'error'); assert.equal(capture, true); listener = callback;
    } },
  });
  return {
    Img,
    fail(image) {
      let stopped = false;
      listener({ target: image, stopImmediatePropagation() { stopped = true; } });
      return stopped;
    },
  };
}

test('cold image failure tries identical object on alternate R2 origin, then one stable retry', () => {
  const { Img, fail } = recovery();
  const original = custom + '/products/original%20design.webp';
  const image = new Img(original);
  assert.equal(image.src, original); // no eager probes or additional requests
  assert.equal(fail(image), true);
  assert.equal(image.src, legacy + '/products/original%20design.webp');
  assert.equal(image.srcset, undefined);
  assert.equal(fail(image), true);
  assert.equal(image.src, original + '?ph-image-retry=1');
  assert.equal(fail(image), false); // normal component fallback, no loop
  image.src = original; // React reasserting a failed source cannot reset budget
  assert.equal(fail(image), false);
});

test('same element gets a fresh bounded recovery budget for a different product', () => {
  const { Img, fail } = recovery();
  const image = new Img(custom + '/products/one.webp');
  fail(image); fail(image); assert.equal(fail(image), false);
  image.src = custom + '/products/two.webp';
  assert.equal(fail(image), true);
  assert.equal(image.src, legacy + '/products/two.webp');
});

test('legacy R2 and IBB recover without proxies, timestamps or storage access', () => {
  const { Img, fail } = recovery();
  const image = new Img(legacy + '/categories/one.webp?v=2');
  fail(image);
  assert.equal(image.src, custom + '/categories/one.webp?v=2');
  const ibb = new Img('https://i.ibb.co/abc/photo.jpg');
  assert.equal(fail(ibb), true);
  assert.equal(ibb.src, 'https://i.ibb.co/abc/photo.jpg?ph-image-retry=1');
  assert.equal(fail(ibb), false);
});

test('unrelated images, private endpoints and non-image failures are untouched', () => {
  const { Img, fail } = recovery();
  for (const src of ['/api/private/image', 'data:image/png;base64,a', 'https://example.com/a.jpg']) {
    const image = new Img(src);
    assert.equal(fail(image), false); assert.equal(image.src, src);
  }
  assert.equal(fail({ src: custom + '/products/script.js' }), false);
});

function worker(caches, fetch) {
  const handlers = {};
  const context = vm.createContext({
    caches, fetch, Response, Request, URL,
    self: { location: { origin: 'https://www.primehubmall.com' },
      addEventListener: (name, fn) => { handlers[name] = fn; } },
  });
  vm.runInContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), context);
  return { context, handlers };
}

test('private-mode cache read/open failures still deliver successful network images', async () => {
  let calls = 0;
  const { context } = worker({
    match: async () => { throw new Error('Storage blocked'); },
    open: async () => { throw new Error('Storage blocked'); },
  }, async () => { calls++; return new Response('image bytes'); });
  const response = await vm.runInContext("imageCacheFirst(new Request('https://www.primehubmall.com/icons/icon-192.png'))", context);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'image bytes');
  assert.equal(calls, 1);
});

test('cache quota failure does not turn an already-downloaded image into a network error', async () => {
  const { context } = worker({
    match: async () => undefined,
    open: async () => ({ put: async () => { throw new Error('QuotaExceeded'); } }),
  }, async () => new Response('valid image'));
  const response = await vm.runInContext("imageCacheFirst(new Request('https://www.primehubmall.com/icons/icon-192.png'))", context);
  assert.equal(await response.text(), 'valid image');
});

test('remote image requests bypass service worker persistence entirely', () => {
  const { handlers } = worker({}, () => { throw new Error('No worker fetch expected'); });
  for (const origin of [custom, legacy, 'https://i.ibb.co']) {
    handlers.fetch({ request: { method: 'GET', url: origin + '/photo.webp', destination: 'image' },
      respondWith() { assert.fail('remote images must use browser HTTP cache'); } });
  }
});
