import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function loadTs(path, modules = {}) {
  const js = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(js, {
    exports,
    require: (name) => {
      if (name === 'server-only') return {};
      if (name === 'next/cache') return { unstable_cache: fn => fn };
      if (modules[name]) return modules[name];
      throw new Error('Unexpected dependency ' + name);
    },
    TextEncoder, TextDecoder, URL, Uint8Array, Uint32Array, DataView, ReadableStream, console,
  }, { filename: path });
  return exports;
}

const category = loadTs('lib/categoryUtils.ts');
const gallery = loadTs('lib/resellerImageGallery.ts', {
  '@/lib/dualReadServer': { getDualFeedCatalog: async () => ({}) },
  '@/lib/publicCatalogServer': { getPublicCatalogSnapshot: async () => ({}) },
  '@/lib/imageUrl': { normalizeImageUrl: url => url },
  '@/lib/categoryUtils': category,
});

test('Only approved image CDNs are downloaded, never an arbitrary host or insecure URL', () => {
  assert.equal(gallery.downloadableImageUrl('https://images.primehubmall.com/cat/img.jpg'), 'https://images.primehubmall.com/cat/img.jpg');
  for (const url of [
    'http://images.primehubmall.com/photo.png',
    'https://images.primehubmall.com.evil.test/photo.png',
    'https://127.0.0.1/admin',
    'https://images.primehubmall.com:444/photo.jpg',
    'data:image/png;base64,AAAA',
  ]) assert.equal(gallery.downloadableImageUrl(url), '', url);
  assert.equal(gallery.safeDownloadName('../bad/**name'), 'bad-name');
});

test('Category gallery includes visible product galleries and variant photos, dedupes repeats', () => {
  const main = 'https://images.primehubmall.com/photos/main.jpg';
  const extra = 'https://images.primehubmall.com/photos/detail.webp';
  const variant = 'https://images.primehubmall.com/photos/blue.png';
  const categories = [{ id: 'cat-glass', title: 'Glass bangles', active: true },
    { id: 'cat-metal', title: 'Metal bangles', active: true }];
  const products = [
    { id: 'p1', title: 'Glass set', active: true, category: 'Glass bangles',
      imageUrl: main, images: [main, extra], variantMatrix: [{ color: 'Blue', imageUrl: variant }, { imageUrl: main }] },
    { id: 'p2', title: 'Unpublished set', category: 'Glass bangles', published: false, imageUrl: extra },
    { id: 'p3', title: 'Metal set', category: 'Metal bangles', imageUrl: 'https://i.ibb.co/safe.jpg' },
  ];
  const result = gallery.assembleGallery(products, categories);
  assert.equal(result.byCategory['glass-bangles'].length, 3);
  assert.equal(result.byCategory['metal-bangles'].length, 1);
  assert.equal(result.categories.find(cat => cat.slug === 'glass-bangles').count, 3);
  assert.equal(result.byCategory['glass-bangles'][2].url, variant);
  assert.equal(result.byCategory['glass-bangles'][0].filename.endsWith('.jpg'), true);
});

test('Download All category manifest is not capped at 40 or only the first visible page', () => {
  const photos = Array.from({ length: 123 }, (_, i) => ({
    id: 'product-' + i,
    title: 'Glass bangles ' + i,
    active: true,
    category: 'Glass bangles',
    imageUrl: 'https://images.primehubmall.com/products/glass-' + i + '.jpg',
  }));
  const result = gallery.assembleGallery(photos, [{ id: 'glass', title: 'Glass bangles' }]);
  assert.equal(result.categories[0].count, 123);
  assert.equal(result.byCategory['glass-bangles'].length, 123);
  assert.equal(result.categories[0].packs, undefined);
  assert.equal(new Set(result.byCategory['glass-bangles'].map(item => item.filename)).size, 123);
});

test('No ZIP or Vercel binary proxy in direct category photo download path', () => {
  const page = fs.readFileSync('app/download-images/page.tsx', 'utf8');
  const endpoint = fs.readFileSync('app/api/reseller/image-gallery/route.ts', 'utf8');
  assert.ok(page.includes('async function downloadAll(categorySlug = selected)'));
  assert.ok(page.includes('void downloadAll(category.slug)'));
  assert.ok(page.includes('for (const photo of allPhotos)'));
  assert.ok(page.includes('await downloadFile(photo, controller)'));
  assert.ok(page.includes("mode: 'cors'"));
  assert.ok(page.includes("credentials: 'omit'"));
  assert.ok(page.includes("getIdToken()"));
  assert.ok(!page.includes("'/api/reseller/image-download'"));
  assert.ok(!fs.existsSync('app/api/reseller/image-download/route.ts'));
  assert.ok(!page.includes('downloadPack('));
  assert.ok(endpoint.includes("params.get('all') === '1'"));
  assert.ok(endpoint.includes("images: all ? images : images.slice"));
  assert.ok(!endpoint.includes('zipReadableStream'));
});

test('Wallet quote skips all shopping wallet Firestore reads until customer opts in', () => {
  const orders = fs.readFileSync('app/api/orders/route.ts', 'utf8');
  const checkout = fs.readFileSync('components/checkout/useCheckout.ts', 'utf8');
  const balance = fs.readFileSync('app/api/reseller/shopping-wallet-balance/route.ts', 'utf8');
  assert.ok(orders.includes('const walletShoppingBalance = (quoteOnly && useShoppingCredit && user)'));
  assert.ok(!orders.includes('if (user) {\\n      try { walletShoppingBalance = await shoppingWalletBalance'));
  assert.ok(checkout.includes("fetch('/api/reseller/shopping-wallet-balance'"));
  assert.ok(checkout.includes('}, [checkoutAuthUid]);'));
  assert.ok(checkout.includes("if (useShoppingCredit) setWalletShoppingBalance"));
  assert.ok(balance.includes('verifyIdToken'));
  assert.ok(balance.includes("Cache-Control': 'private, no-store'"));
});
