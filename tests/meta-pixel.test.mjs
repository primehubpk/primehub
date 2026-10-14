import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function browser(path = '/') {
  const scripts = [];
  const window = { location: { pathname: path } };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync('lib/metaPixel.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports, window, process: { env: {} }, document: {
    createElement: () => ({}), head: { appendChild: script => scripts.push(script) },
  } });
  return { api: exports, window, scripts, events: () => JSON.parse(JSON.stringify(window.fbq?.queue || [])) };
}

test('loads asynchronously once and counts storefront navigation without duplicate hydration views', () => {
  const b = browser();
  b.api.trackMetaPageView(); b.api.trackMetaPageView();
  b.window.location.pathname = '/shop'; b.api.trackMetaPageView();
  assert.equal(b.scripts.length, 1);
  assert.equal(b.scripts[0].async, true);
  assert.equal(b.events().filter(e => e[0] === 'init').length, 1);
  assert.equal(b.events().filter(e => e[2] === 'PageView').length, 2);
});

test('product IDs, live price, currency and quantities match the catalog', () => {
  const b = browser('/product/jelly-6');
  b.api.trackMetaStoreEvent('ViewContent', { contents: [{ content_id: 'jelly-6', num_items: 1, price: 2499 }], value: 2499, currency: 'PKR' }, 'view-1');
  const event = b.events().at(-1);
  assert.equal(event[2], 'ViewContent');
  assert.deepEqual(event[3].content_ids, ['jelly-6']);
  assert.deepEqual(event[3].contents, [{ id: 'jelly-6', quantity: 1, item_price: 2499 }]);
  assert.equal(event[3].value, 2499); assert.equal(event[3].currency, 'PKR');
});

test('successful order event becomes Purchase once per order without customer details', () => {
  const b = browser('/checkout');
  const payload = { contents: [{ content_id: 'p1', num_items: 5, price: 99 }], value: 495, currency: 'PKR', customer: { phone: 'private', address: 'private' } };
  b.api.trackMetaStoreEvent('PlaceAnOrder', payload, 'order_123');
  b.api.trackMetaStoreEvent('PlaceAnOrder', payload, 'order_123');
  const events = b.events().filter(e => e[2] === 'Purchase');
  assert.equal(events.length, 1);
  assert.equal(events[0][3].num_items, 5);
  assert.equal(events[0][3].value, 495);
  assert.deepEqual(events[0][4], { eventID: 'order_123' });
  assert.equal(JSON.stringify(events).includes('private'), false);
});

test('admin and reseller screens emit no analytics and blocked scripts never break shopping', () => {
  const b = browser('/admin'); b.api.trackMetaPageView(); b.api.trackMetaStoreEvent('PlaceAnOrder', {value: 100}, 'test');
  assert.equal(b.scripts.length, 0);
  b.window.location.pathname = '/';
  b.api.trackMetaPageView();
  b.window.fbq.callMethod = () => { throw new Error('blocked'); };
  assert.doesNotThrow(() => b.api.trackMetaStoreEvent('AddToCart', {value: 99, currency: 'PKR'}));
});
