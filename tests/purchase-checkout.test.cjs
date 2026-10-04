const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loader(overrides = {}) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      fileName: file,
    }).outputText;
    const resolve = name => {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (name.startsWith('@/') || name.startsWith('.')) {
        const base = name.startsWith('@/') ? path.resolve(name.slice(2)) : path.resolve(path.dirname(file), name);
        return load(fs.existsSync(base) && fs.statSync(base).isFile() ? base : base + '.ts');
      }
      return require(name);
    };
    new Function('require', 'module', 'exports', source)(resolve, module, module.exports);
    return module.exports;
  }
  return load;
}

const load = loader();
const { calculateDeliveryCharge, freeDeliveryPolicy } = load('lib/deliveryCharges.ts');
const { normalizeProductVariants } = load('lib/productVariants.ts');

test('four items pay delivery; five or more waive base and wholesale surcharge; reducing restores charges', () => {
  assert.equal(calculateDeliveryCharge([{ qty: 4 }]).deliveryCharge, 350);
  assert.equal(calculateDeliveryCharge([{ qty: 5 }]).deliveryCharge, 0);
  assert.equal(calculateDeliveryCharge([{ qty: 3 }, { quantity: 2, isWholesale: true }]).deliveryCharge, 0);
  assert.equal(calculateDeliveryCharge([{ qty: 4, isWholesale: true }]).deliveryCharge, 470);
  assert.equal(calculateDeliveryCharge([{ qty: 9 }]).deliveryCharge, 0);
  assert.equal(calculateDeliveryCharge([{ qty: 5 }], { enabled: false }).deliveryCharge, 350);
  assert.equal(calculateDeliveryCharge([{ qty: 5 }], { itemThreshold: 6 }).deliveryCharge, 350);
  assert.equal(freeDeliveryPolicy({ itemThreshold: NaN }).threshold, 5);
});

test('real variants are recognized in matrix or legacy rows; flags alone never invent variants', () => {
  for (const product of [
    { id: 'watch', hasVariants: true },
    { id: 'bag', variants: [], variantColors: ['Black'] },
    { id: 'shoes', variantMatrix: [] },
  ]) assert.equal(normalizeProductVariants(product).hasVariants, false);
  for (const field of ['variants', 'variantMatrix']) {
    const result = normalizeProductVariants({ id: 'bangle', price: 299, [field]: [{ color: 'Silver', size: '2.6' }] });
    assert.equal(result.hasVariants, true);
    assert.equal(result.rows[0].stock, 30);
    assert.equal(result.rows[0].size, '2.6');
  }
});

test('shared cart guard refuses silent variant additions even when a card omits variants', async () => {
  let reads = 0;
  let product = { id: 'bangle', price: 299, variantMatrix: [{ color: 'Silver', size: '2.6', stock: 30 }] };
  const oldFetch = global.fetch;
  global.fetch = async () => { reads++; return { ok: true, json: async () => ({ product }) }; };
  try {
    global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
    const localLoad = loader();
    const { useCartStore } = localLoad('lib/cartStore.ts');
    const item = { id: 'bangle', name: 'Bangles', price: 299, originalPrice: 299, image: '/test.jpg' };
    assert.equal(await useCartStore.getState().addItem(item), false);
    assert.equal(useCartStore.getState().items.length, 0);
    assert.equal(useCartStore.getState().variantModalProduct.id, 'bangle');
    useCartStore.getState().closeVariantModal();
    assert.equal(await useCartStore.getState().addItem({ ...item, variant: { color: 'Silver', size: '2.6' } }, 5), true);
    assert.equal(useCartStore.getState().items[0].qty, 5);
    assert.equal(reads, 2);
    useCartStore.getState().clearCart();
    product = { id: 'watch', price: 299, hasVariants: true };
    assert.equal(await useCartStore.getState().addItem({ ...item, id: 'watch' }), true);
    assert.equal(useCartStore.getState().items[0].variant, undefined);
    assert.equal(useCartStore.getState().variantModalProduct, null);
    global.fetch = async () => { throw new Error('offline'); };
    assert.equal(await useCartStore.getState().addItem({ ...item, id: 'bag' }), false);
    assert.equal(useCartStore.getState().items.length, 1, 'read failure cannot silently add an unverified product');
  } finally { global.fetch = oldFetch; }
});

test('purchase reads deduplicate simultaneous taps without reusing stale snapshots later', async () => {
  const oldFetch = global.fetch;
  let reads = 0;
  global.fetch = async () => { reads++; return { ok: true, json: async () => ({ product: { id: 'one', price: 200 } }) }; };
  try {
    const { loadProductForPurchase } = loader()('lib/purchaseProduct.ts');
    await Promise.all([loadProductForPurchase('one'), loadProductForPurchase('one')]);
    assert.equal(reads, 1);
    await loadProductForPurchase('one');
    assert.equal(reads, 2);
  } finally { global.fetch = oldFetch; }
});

test('order quote and saved order use the same free delivery; variant choice is mandatory server-side', async () => {
  const products = { watch: { id: 'watch', title: 'Watch', price: 299, stock: 30 }, bangle: { id: 'bangle', title: 'Bangle', price: 299, stock: 30, variants: [{ color: 'Silver', size: '2.6', price: 299, stock: 30 }] } };
  let saved;
  const route = loader({
    '@/lib/dualReadServer': {
      getDualProduct: async id => ({ product: products[id] }),
      getDualStorefrontSettings: async () => ({ documents: { main: { freeDelivery: { enabled: true, itemThreshold: 5 } } } }),
    },
    '@/lib/firebaseAdmin': { getAdminDb: () => ({ collection: () => ({ doc: () => ({ set: async value => { saved = value; } }) }) }), getAdminAuth: () => ({}) },
    '@/lib/dualWriteServer': { isSupabaseWriteConfigured: () => false, mapOrderToSupabase: value => value, mirrorSupabaseUpsert: async () => ({ attempted: false }), recordMirrorFailure: async () => {}, supabasePrimaryUpsert: async () => { throw new Error('Unexpected database write'); } },
  })('app/api/orders/route.ts');
  const request = body => new Request('https://test.invalid/api/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  for (const qty of [4, 5, 6, 4]) {
    const result = await route.POST(request({ mode: 'quote', items: [{ id: 'watch', qty }] }));
    assert.equal(result.status, 200);
    const quote = await result.json();
    assert.equal(quote.deliveryCharge, qty >= 5 ? 0 : 350);
    assert.equal(quote.total, 299 * qty + (qty >= 5 ? 0 : 350));
  }
  const pickup = await route.POST(request({ mode: 'quote', selfCollect: true, items: [{ id: 'watch', qty: 1 }] }));
  assert.equal((await pickup.json()).deliveryCharge, 0);
  for (const variant of [undefined, { color: 'Silver' }, { color: 'Silver', size: 'wrong' }]) {
    const bad = await route.POST(request({ mode: 'quote', items: [{ id: 'bangle', qty: 5, variant }] }));
    assert.notEqual(bad.status, 200);
  }
  const valid = await route.POST(request({ mode: 'quote', items: [{ id: 'bangle', qty: 5, variant: { color: 'Silver', size: '2.6' } }] }));
  assert.equal((await valid.json()).deliveryCharge, 0);
  const submitted = await route.POST(request({ items: [{ id: 'watch', qty: 5 }], customer: { name: 'Test', phone: '03000000000', city: 'Test', address: 'Test' } }));
  assert.equal(submitted.status, 200);
  assert.equal(saved.deliveryCharge, 0);
  assert.equal(saved.total, 1495);
});

test('shopping return rejects external and checkout-loop destinations', () => {
  const { safeShoppingPath } = load('lib/shoppingReturn.ts');
  assert.equal(safeShoppingPath('/product/abc?deal=big'), '/product/abc?deal=big');
  assert.equal(safeShoppingPath('/category/bangles?q=silver'), '/category/bangles?q=silver');
  for (const path of ['//evil.example', '/\\evil.example', '/checkout', '/cart']) assert.equal(safeShoppingPath(path), '');
});
