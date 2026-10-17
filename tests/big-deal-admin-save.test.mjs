import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function load(sourcePath, dependencies, globals = {}) {
  const compiled = ts.transpileModule(readFileSync(sourcePath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, require: (name) => {
      if (name in dependencies) return dependencies[name];
      throw new Error('Unexpected import: ' + name);
    },
    console, Date, Intl, Math, Number, String, Boolean, JSON, Object, Array,
    URLSearchParams, AbortSignal, Response, Request, fetch: globals.fetch, process: globals.process,
  });
  return exports;
}

const rotation = load('lib/bigDealRotation.ts', {});

test('saving with the selected slot as today preserves the full seven-day rotation', () => {
  const today = new Date('2026-10-17T10:00:00.000Z');
  for (let selected = 0; selected < 7; selected += 1) {
    const anchor = new Date(today.getTime() - selected * 86_400_000).toISOString();
    assert.equal(rotation.bigDealRotationIndex(anchor, today, 7), selected);
    assert.equal(rotation.bigDealRotationIndex(anchor, new Date(today.getTime() + 86_400_000), 7), (selected + 1) % 7);
  }
});

const sampleDeal = () => ({
  active: true,
  imageUrl: 'https://example.test/deal-1.jpg',
  imageUrls: Array.from({ length: 7 }, (_, i) => 'https://example.test/deal-' + (i + 1) + '.jpg'),
  galleryImages: Array(7).fill(''),
  productId: 'product-1',
  productIds: Array.from({ length: 7 }, (_, i) => 'product-' + (i + 1)),
  title: 'Deal 1', titles: Array.from({ length: 7 }, (_, i) => 'Deal ' + (i + 1)),
  categoryIds: Array(7).fill('bangles'),
  originalPrice: 3000, dealPrice: 999,
  originalPrices: Array(7).fill(3000), dealPrices: Array(7).fill(999),
  rotationStartedAt: '2026-10-16T10:00:00.000Z',
  startAt: '', endAt: '', buttonText: 'Shop Big Deal', buttonLink: '/deals/big',
});

function setupRoute(writePersists) {
  const live = { bigDeal: { ...sampleDeal(), rotationStartedAt: '2026-10-10T10:00:00.000Z' }, unrelatedSiteSetting: 'preserve' };
  const paths = [];
  const tags = [];
  const fetchMock = async (url, init = {}) => {
    if (init.method === 'POST') {
      if (writePersists) Object.assign(live, JSON.parse(init.body).payload);
      return new Response(null, { status: 201 });
    }
    assert.match(url, /settings\?id=eq.main&select=payload/);
    return Response.json([{ payload: live }]);
  };
  const route = load('app/api/admin/big-deal/route.ts', {
    'next/server': { NextResponse: { json: (data, options) => Response.json(data, options) } },
    'next/cache': { revalidateTag: (tag) => tags.push(tag), revalidatePath: (path) => paths.push(path) },
    'firebase-admin/firestore': { FieldValue: { delete: () => '__delete__' } },
    '@/lib/dualReadServer': {
      getDualStorefrontSettings: async () => ({ documents: { main: live }, source: 'supabase' }),
      getDualCatalog: async () => ({ products: [], categories: [], source: 'supabase' }),
    },
    '@/lib/firebaseAdmin': { getAdminDb: () => ({
      collection: () => ({ doc: () => ({
        set: async () => {},
        get: async () => ({ exists: false, data: () => ({}) }),
      }) }),
    }) },
  }, { fetch: fetchMock, process: { env: {
    SUPABASE_URL: 'https://example.test', SUPABASE_SERVICE_ROLE_KEY: 'test',
  } } });
  return { route, paths, tags, live };
}

async function save(route) {
  return route.POST(new Request('https://example.test/api/admin/big-deal', {
    method: 'POST',
    headers: { cookie: 'primehub_admin_auth=true', 'content-type': 'application/json' },
    body: JSON.stringify({ dailyDeal: sampleDeal() }),
  }));
}

test('Big Deal returns success only for verified Supabase storage and refreshes both storefront pages', async () => {
  const { route, live, paths, tags } = setupRoute(true);
  const response = await save(route);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.equal(body.source, 'supabase');
  assert.equal(body.dailyDeal.productIds.length, 7);
  assert.equal(live.unrelatedSiteSetting, 'preserve');
  assert.deepEqual(paths, ['/', '/deals/big']);
  assert.ok(tags.includes('storefront-settings'));
});

test('Big Deal does not report success when the database did not persist the new rotation', async () => {
  const { route, paths } = setupRoute(false);
  const response = await save(route);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).success, undefined);
  assert.deepEqual(paths, []);
});
