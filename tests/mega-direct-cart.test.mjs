import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const compile = path => ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
} }).outputText;
function load(path, require = () => ({})) {
  const exports = {};
  vm.runInNewContext(compile(path), { exports, require, setTimeout, clearTimeout, URL, console, Error });
  return exports;
}
const { prepareMegaCartItem, MAX_MEGA_CART_QUANTITY } = load('lib/megaDealCart.ts');
const { megaImageNeedsTrim } = load('lib/megaImagePresentation.ts');
const normalized = load('lib/cartStore.ts', name => name === 'zustand' ? { create: () => () => null }
  : name === 'zustand/middleware' ? { persist: x => x, createJSONStorage: () => null } : {});
const product = { id: 'real', title: 'Box', price: 1209, megaDealPrice: 1209, originalPrice: 3000, imageUrl: 'original.webp', stock: 30,
  variantMatrix: [{ id: 'a', color: 'Same as shown', size: '2.4', stock: 2, price: 3500 },
    { id: 'b', color: 'Same as shown', size: '2.6', stock: 3, price: 3500 }] };
const rows = normalized.normalizeProductVariants(product).rows;

test('direct cart preserves exact canonical variant identity, image and Mega price', () => {
  const before = JSON.stringify(product);
  const { item } = prepareMegaCartItem(product, rows, '2.4', '', []);
  assert.equal(item.id, 'real:color:Same as shown|size:2.4');
  assert.equal(item.variant.size, '2.4');
  assert.equal(item.variant.color, 'Same as shown');
  assert.equal(item.price, 1209);
  assert.equal(item.image, 'original.webp');
  assert.equal(JSON.stringify(product), before);
});

test('size must be selected and zero-stock or stale size never falls back to another row', () => {
  assert.throws(() => prepareMegaCartItem(product, rows, '', '', []), /choose a size/);
  assert.throws(() => prepareMegaCartItem(product, rows, '2.8', '', []), /no longer in stock/);
  assert.throws(() => prepareMegaCartItem(product, rows.map(row => ({ ...row, stock: 0 })), '2.4', '', []), /no longer in stock/);
});

test('multiple colours stay explicit and retain selected row price and photo', () => {
  const other = [...rows, { ...rows[0], color: 'Gold', imageUrl: 'gold.webp' }];
  const pending = prepareMegaCartItem(product, other, '2.4', '', []);
  assert.equal(pending.item, null);
  assert.equal(pending.colors.join(','), 'Same as shown,Gold');
  assert.equal(prepareMegaCartItem(product, other, '2.4', 'Gold', []).item.image, 'gold.webp');
  assert.throws(() => prepareMegaCartItem(product, other, '2.4', 'Removed', []), /no longer available/);
});

test('existing cart quantity cannot exceed verified row stock', () => {
  const item = prepareMegaCartItem(product, rows, '2.4', '', []).item;
  assert.throws(() => prepareMegaCartItem(product, rows, '2.4', '', [{ ...item, qty: 2 }]), /No more stock/);
  assert.ok(prepareMegaCartItem(product, rows, '2.6', '', [{ ...item, qty: 2 }]).item);
});

test('simple products retain direct add, explicit zero stock and invalid prices reject', () => {
  assert.equal(prepareMegaCartItem(product, [], '', '', []).item.variant, undefined);
  assert.throws(() => prepareMegaCartItem({ ...product, stock: 0 }, [], '', '', []), /No more stock/);
  assert.throws(() => prepareMegaCartItem({ ...product, price: 0 }, [], '', '', []), /price is unavailable/);
});

test('trim is limited to reviewed padded sources and never touches a new Admin photo', () => {
  const id = 'olyH0uP7w0c1OHqUCZvf';
  const url = 'https://images.primehubmall.com/products/IMG-20260506-WA0202-1585f6856430.webp';
  assert.equal(megaImageNeedsTrim(id, url), true);
  assert.equal(megaImageNeedsTrim(id, url.replace('1585f6856430', 'new-upload')), false);
  assert.equal(megaImageNeedsTrim('ordinary', url), false);
  assert.equal(megaImageNeedsTrim('16CbiM9CdxtvhszzGYGu', url), false);
});

function harness(fresh = product) {
  const state = [], refs = [], cart = [];
  let cursor = 0, refCursor = 0, reads = 0, modal = 0;
  const store = selector => selector({ addItem: item => cart.push({ ...item, qty: 1 }), openVariantModal: () => { modal++; } });
  store.getState = () => ({ items: cart });
  const card = load('components/home/GlassOfferCard.tsx', name => {
    if (name === 'react') return { useId: () => 'quantity-test', useState: value => { const index = cursor++; if (!(index in state)) state[index] = value; return [state[index], value => { state[index] = value; }]; },
      useRef: value => { const index = refCursor++; return refs[index] || (refs[index] = { current: value }); } };
    if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
    if (name === '@/lib/cartStore') return { ...normalized, useCartStore: store };
    if (name === '@/lib/verifiedDealProduct') return { getVerifiedDealProduct: async () => { reads++; if (fresh instanceof Error) throw fresh; return fresh; } };
    if (name === '@/lib/megaDealCart') return { prepareMegaCartItem, MAX_MEGA_CART_QUANTITY };
    if (name === '@/lib/megaImagePresentation') return { megaImageNeedsTrim };
    if (name === '@/lib/imageUrl') return { normalizeImageUrl: x => x, isDirectStorefrontImage: () => true };
    if (name === '@/components/shop/ShopTypes') return { imageOf: p => p.imageUrl };
    return {};
  }).default;
  const render = () => { cursor = 0; refCursor = 0; return card({ offer: { product: { ...product, variantMatrix: undefined, availableSizes: ['2.4', '2.6'] }, price: 1209, referencePrice: 3000, savingPercent: 60 } }); };
  const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
  const button = (tree, label) => nodes(tree).find(n => n.type === 'button' && (n.props['aria-label'] || '').includes(label));
  return { render, button, nodes, cart, counts: () => ({ reads, modal }) };
}

test('real card size click performs no network read or modal; Add carries selected size', async () => {
  const h = harness();
  h.button(h.render(), 'Choose size 2.4').props.onClick();
  assert.equal(h.counts().reads, 0);
  assert.equal(h.button(h.render(), 'Choose size 2.4').props['aria-pressed'], true);
  const add = h.button(h.render(), 'to cart');
  add.props.onClick(); add.props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.counts().reads, 1);
  assert.equal(h.counts().modal, 0);
  assert.equal(h.cart.length, 1);
  assert.equal(h.cart[0].variant.size, '2.4');
});

test('failed fresh read leaves cart empty, shows error and enables retry', async () => {
  const h = harness(new Error('Network unavailable'));
  h.button(h.render(), 'Choose size 2.4').props.onClick();
  h.button(h.render(), 'to cart').props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  const tree = h.render();
  assert.equal(h.cart.length, 0);
  assert.equal(h.button(tree, 'to cart').props.disabled, false);
  assert.equal(h.nodes(tree).find(n => n.props?.role === 'alert').props.children, 'Network unavailable');
});

test('requested quantity is checked against fresh stock and existing cart before adding any units', () => {
  const item = prepareMegaCartItem(product, rows, '2.4', '', [], 2).item;
  assert.ok(item);
  assert.throws(() => prepareMegaCartItem(product, rows, '2.4', '', [], 3), /No more stock/);
  assert.throws(() => prepareMegaCartItem(product, rows, '2.4', '', [{ ...item, qty: 1 }], 2), /No more stock/);
  for (const qty of [0, -1, 1.5, NaN, 51]) assert.throws(() => prepareMegaCartItem(product, rows, '2.4', '', [], qty), /quantity from 1 to 50/);
  const lots = { ...product, stock: 100 };
  assert.throws(() => prepareMegaCartItem(lots, [], '', '', [{ id: 'real', qty: 49 }], 2), /Maximum 50/);
});

test('card quantity selects two of the same size with one fresh read and no modal', async () => {
  const h = harness();
  h.button(h.render(), 'Choose size 2.4').props.onClick();
  h.button(h.render(), 'Increase Box quantity').props.onClick();
  h.button(h.render(), 'to cart').props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.counts().reads, 1);
  assert.equal(h.counts().modal, 0);
  assert.equal(h.cart.length, 2);
  assert.ok(h.cart.every(item => item.variant.size === '2.4' && item.price === 1209));
});


test('successful add exposes My Cart navigation instead of a second add action', async () => {
  const h = harness();
  h.button(h.render(), 'Choose size 2.4').props.onClick();
  h.button(h.render(), 'to cart').props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  const nodes = h.nodes(h.render());
  assert.ok(nodes.find(node => node.props?.href === '/cart' && node.props?.['aria-label'] === 'My Cart after adding Box'));
  assert.equal(h.button(h.render(), 'to cart'), undefined);
  h.button(h.render(), 'Increase Box quantity').props.onClick();
  assert.ok(h.button(h.render(), 'to cart'));
});
