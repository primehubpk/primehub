import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(path, dependencies, globals = {}) {
  const source = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, require: name => {
    if (name in dependencies) return dependencies[name];
    if (name === 'node:crypto') return require(name);
    throw new Error(`Unexpected dependency ${name}`);
  }, console, setTimeout, URLSearchParams, AbortSignal, process, ...globals });
  return exports;
}
const policy = load('lib/storefrontCachePolicy.ts', {});

function setup() {
  const cache = new Map();
  const reads = new Map();
  const products = new Map(['a', 'b'].map(id => [id, { id, price: 100, title: id }]));
  const invalidated = [];
  const nextCache = {
    unstable_cache: (fn, key, options) => async (...args) => {
      const name = JSON.stringify([key, args]);
      if (cache.has(name)) return cache.get(name).value;
      const value = await fn(...args);
      cache.set(name, { value, tags: options.tags });
      return value;
    },
    revalidateTag: tag => {
      invalidated.push(tag);
      for (const [key, entry] of cache) if (entry.tags.includes(tag)) cache.delete(key);
    },
  };
  const dual = {
    getDualProduct: async id => {
      reads.set(id, (reads.get(id) || 0) + 1);
      return { product: products.get(id) || null, source: products.has(id) ? 'supabase' : 'empty' };
    },
    getDualCatalog: async () => ({ products: [...products.values()], categories: [], source: 'supabase' }),
    getDualCategories: async () => ({ categories: [{ id: 'c' }], source: 'supabase' }),
  };
  const snapshots = load('lib/publicCatalogServer.ts', {
    'server-only': {}, 'next/cache': nextCache,
    '@/lib/storefrontCachePolicy': policy, '@/lib/dualReadServer': dual,
    '@/lib/storefrontSettingsServer': {}, '@/lib/wholesaleVideosServer': {},
  });
  const admin = load('app/api/admin/firestore/route.ts', {
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
    'next/cache': nextCache, '@/lib/storefrontCachePolicy': policy,
    '@/lib/firebaseAdmin': { getAdminDb: () => ({ collection: () => ({ doc: () => ({ id: 'new', set: async () => {}, delete: async () => {} }) }) }) },
    '@/lib/dualWriteServer': {
      getSupabasePrimaryPayload: async (name, id) => products.get(id),
      mapDocumentToSupabase: (name, id, data) => ({ id, ...data }),
      supabasePrimaryUpsert: async ({ row }) => products.set(row.id, row),
      supabasePrimaryDelete: async ({ id }) => products.delete(id),
    },
  });
  async function write(action, name, id, value) {
    const response = await admin.POST(new Request('https://store.example/api/admin/firestore', {
      method: 'POST', headers: { cookie: 'primehub_admin_auth=true', 'content-type': 'application/json' },
      body: JSON.stringify({ action, name, id, value }),
    }));
    assert.equal(response.status, 200);
  }
  return { snapshots, reads, products, invalidated, nextCache, write };
}

test('editing one product refreshes it and catalog, while another product and category directory stay cached', async () => {
  const { snapshots: s, reads, write } = setup();
  const a = await s.getPublicProductSnapshot('a');
  const b = await s.getPublicProductSnapshot('b');
  const catalog = await s.getPublicCatalogSnapshot();
  const categories = await s.getPublicCategoriesSnapshot();
  await write('update', 'products', 'a', { price: 250 });
  assert.equal((await s.getPublicProductSnapshot('a')).product.price, 250);
  assert.notEqual(await s.getPublicProductSnapshot('a'), a);
  assert.equal(await s.getPublicProductSnapshot('b'), b);
  assert.notEqual(await s.getPublicCatalogSnapshot(), catalog);
  assert.equal(await s.getPublicCategoriesSnapshot(), categories);
  assert.equal(reads.get('a'), 2);
  assert.equal(reads.get('b'), 1);
});

test('all admin write actions target the affected product, never the entire product cache', async () => {
  for (const action of ['create', 'update', 'replace', 'set', 'delete']) {
    const { write, invalidated } = setup();
    await write(action, 'products', 'a', { title: 'Updated', price: 300 });
    assert.ok(invalidated.includes(policy.publicProductCacheTag(action === 'create' ? 'new' : 'a')));
    assert.ok(invalidated.includes('public-catalog'));
    assert.ok(!invalidated.includes('public-products'));
  }
});

test('category writes invalidate both the directory and the catalog', async () => {
  const { snapshots: s, write } = setup();
  const categories = await s.getPublicCategoriesSnapshot();
  const catalog = await s.getPublicCatalogSnapshot();
  await write('replace', 'categories', 'c', { title: 'Bangles' });
  assert.notEqual(await s.getPublicCategoriesSnapshot(), categories);
  assert.notEqual(await s.getPublicCatalogSnapshot(), catalog);
});

test('explicit full refresh still invalidates every product; unavailable data is retried', async () => {
  const { snapshots: s, nextCache, reads, products } = setup();
  await s.getPublicProductSnapshot('a');
  await s.getPublicProductSnapshot('b');
  nextCache.revalidateTag('public-products');
  await s.getPublicProductSnapshot('a');
  await s.getPublicProductSnapshot('b');
  assert.equal(reads.get('a'), 2);
  assert.equal(reads.get('b'), 2);
  await assert.rejects(s.getPublicProductSnapshot('missing'), /unavailable/);
  products.set('missing', { id: 'missing', price: 50 });
  assert.equal((await s.getPublicProductSnapshot('missing')).product.price, 50);
});

test('purchase reads bypass a previously cached product', async () => {
  const { snapshots: s, products } = setup();
  await s.getPublicProductSnapshot('a');
  products.set('a', { id: 'a', price: 500 });
  assert.equal((await s.getPublicProductSnapshot('a')).product.price, 100);
  assert.equal((await s.getFreshPublicProductSnapshot('a')).product.price, 500);
});

test('a missing primary product is distinguishable from a temporary data outage', async () => {
  let fail = false;
  const dual = load('lib/dualReadServer.ts', {
    'server-only': {},
    '@/lib/firebaseAdmin': { getAdminDb: () => { throw new Error('Unexpected Firebase fallback'); } },
  }, {
    process: { env: { SUPABASE_URL: 'https://fixture.invalid', SUPABASE_ANON_KEY: 'fixture', PRIMEHUB_DATA_READ_MODE: 'supabase-only' } },
    fetch: async () => fail ? new Response('Unavailable', { status: 503 }) : Response.json([]),
    console: { warn() {}, error() {} },
  });
  const missing = await dual.getDualProduct('deleted-product');
  assert.equal(missing.product, null);
  assert.equal(missing.source, 'supabase');
  fail = true;
  assert.equal((await dual.getDualProduct('existing-product')).source, 'empty');
});
