import assert from 'node:assert/strict';
import test from 'node:test';

test('product open adds one history step and back restores the same page', async () => {
  const entries = [{ state: { __NA: true }, url: '/shop?q=bangles' }];
  let index = 0;
  const popListeners = [];
  const body = { style: {}, dataset: {} };

  globalThis.window = {
    scrollY: 640,
    pageYOffset: 640,
    history: {
      scrollRestoration: 'auto',
      get state() { return entries[index].state; },
      pushState(state, _title, url) {
        entries.splice(index + 1);
        entries.push({ state, url });
        index += 1;
        // A history update in the WebView often jumps the page to the top.
        globalThis.window.scrollY = 0;
        globalThis.window.pageYOffset = 0;
      },
      replaceState(state, _title, url) {
        entries[index] = { state, url };
      },
      back() {
        index -= 1;
        globalThis.window.scrollY = 0;
        globalThis.window.pageYOffset = 0;
        for (const listener of popListeners) listener({ stopImmediatePropagation() {} });
      },
    },
    location: {
      get pathname() { return new URL(entries[index].url, 'https://primehubmall.com').pathname; },
      get search() { return new URL(entries[index].url, 'https://primehubmall.com').search; },
      get hash() { return ''; },
      origin: 'https://primehubmall.com',
    },
    addEventListener(type, listener) {
      if (type === 'popstate') popListeners.push(listener);
    },
    dispatchEvent() { return true; },
    scrollTo(_x, y) {
      const top = typeof _x === 'object' && _x ? Number(_x.top || 0) : Number(y || 0);
      globalThis.window.scrollY = top;
      globalThis.window.pageYOffset = top;
    },
    requestAnimationFrame(callback) { callback(); },
    setTimeout(callback) { callback(); return 0; },
  };
  globalThis.document = { body };

  const overlay = await import('../lib/productOverlay.ts');
  overlay.openProductOverlay({
    id: 'ring-1',
    href: '/product/ring-1',
    bigDeal: false,
    product: { id: 'ring-1', title: 'Ring' },
  });

  assert.equal(overlay.isProductOverlayOpen(), true);
  assert.equal(entries[index].url, '/product/ring-1');
  assert.equal(entries[index].state, null);
  assert.equal(overlay.getProductOverlayBackgroundPath(), '/shop?q=bangles');
  assert.equal(window.scrollY, 640);
  assert.equal(body.style.position || '', '');

  overlay.openProductOverlay({
    id: 'ring-2',
    href: '/product/ring-2',
    bigDeal: false,
    product: { id: 'ring-2', title: 'Ring 2' },
  });
  assert.equal(entries.length, 2);
  assert.equal(entries[index].url, '/product/ring-2');

  overlay.closeProductOverlayNow();
  assert.equal(overlay.isProductOverlayOpen(), false);
  assert.equal(entries[index].url, '/shop?q=bangles');
  assert.equal(window.scrollY, 640);
  assert.equal(entries.length, 2);
});
