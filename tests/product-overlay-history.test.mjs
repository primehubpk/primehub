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
        popListeners.forEach(listener => listener({ stopImmediatePropagation() {} }));
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
    setTimeout(callback, delay) {
      if (!delay || delay < 100) callback();
      return 0;
    },
    clearTimeout() {},
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
  assert.equal(index, 0, "Back consumes the overlay entry instead of duplicating the list");
  overlay.openProductOverlay({ id: "ring-3", href: "/product/ring-3", bigDeal: false, product: null });
  overlay.closeProductOverlayNow();
  assert.equal(index, 0);
  assert.equal(entries.length, 2, "Repeated product opens do not grow history");
});

test('a weekly deal page asks to go home in one step', async () => {
  globalThis.window = {
    scrollY: 20,
    pageYOffset: 20,
    history: {
      scrollRestoration: 'auto',
      state: { __NA: true },
      pushState() {},
      replaceState() {},
      back() {},
    },
    location: {
      pathname: '/deals/friday',
      search: '',
      hash: '',
      origin: 'https://primehubmall.com',
    },
    addEventListener() {},
    dispatchEvent() { return true; },
    scrollTo() {},
    requestAnimationFrame(callback) { callback(); },
    setTimeout() { return 0; },
    clearTimeout() {},
    sessionStorage: {
      getItem() { return null; },
      setItem() {},
      removeItem() {},
    },
  };

  const overlay = await import('../lib/productOverlay.ts');
  assert.equal(overlay.isProductOverlayOpen(), false);
  assert.equal(overlay.requestStorefrontHome(), 'router-home');
});
