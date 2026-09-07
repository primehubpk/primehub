import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../lib/salaarSalesMemoryCore.ts', import.meta.url), 'utf8');
const transpiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`;
const {
  resolveSalesTurnWithMemory,
  sanitizeSalaarSalesMemory,
  updateSalaarSalesMemory,
  salesMemoryPromptContext,
} = await import(moduleUrl);

const products = [
  { id: 'p1', title: 'Red Glass Bangles', category: 'Glass Bangles', color: 'Red', material: 'Glass' },
  { id: 'p2', title: 'Gold Glass Bangles', category: 'Glass Bangles', color: 'Gold', material: 'Glass' },
  { id: 'p3', title: 'Silver Glass Bangles', category: 'Glass Bangles', color: 'Silver', material: 'Glass' },
];

const memory = sanitizeSalaarSalesMemory({
  currentQuery: 'glass bangles 1000 tak',
  filters: { category: 'Glass Bangles', maxPrice: 1000 },
  lastShownProductIds: ['p1', 'p2', 'p3'],
  cart: [{ productId: 'p2', name: 'Gold Glass Bangles', quantity: 2 }],
  updatedAt: '2026-09-07T12:00:00.000Z',
});

const baseIntent = (overrides = {}) => ({
  wantsProducts: true,
  filters: {},
  followUp: { more: false, cheaper: false, pricier: false, compare: false },
  sortBy: 'relevance',
  terms: [],
  ...overrides,
});

{
  const result = resolveSalesTurnWithMemory('2nd wala acha hai', {
    ...baseIntent(),
    followUp: { more: false, cheaper: false, pricier: false, compare: false, referencedPosition: 2 },
  }, memory, products);
  assert.equal(result.selectedProductId, 'p2');
  assert.equal(result.referenceOnly, true);
  assert.equal(result.intent.filters.category, 'Glass Bangles');
  assert.equal(result.intent.filters.maxPrice, 1000);
}

{
  const result = resolveSalesTurnWithMemory('isko silver mein dikhao', {
    ...baseIntent(),
    filters: { color: 'Silver' },
  }, { ...memory, selectedProductId: 'p2' }, products);
  assert.equal(result.intent.filters.color, 'Silver');
  assert.equal(result.intent.filters.category, 'Glass Bangles');
  assert.equal(result.intent.filters.material, 'Glass');
  assert.equal(result.memoryUsed, true);
}

{
  const result = resolveSalesTurnWithMemory('same jaisa aur dikhao', {
    ...baseIntent(),
  }, { ...memory, selectedProductId: 'p2' }, products);
  assert.equal(result.intent.followUp.more, true);
  assert.equal(result.intent.filters.category, 'Glass Bangles');
  assert.equal(result.intent.filters.color, 'Gold');
}

{
  const result = resolveSalesTurnWithMemory('1st aur 2nd compare karo', {
    ...baseIntent({}),
    followUp: { more: false, cheaper: false, pricier: false, compare: true, referencedPosition: 1 },
  }, memory, products);
  assert.deepEqual(result.comparisonProductIds, ['p1', 'p2']);
}

{
  const next = updateSalaarSalesMemory({
    previous: memory,
    message: 'silver mein dikhao',
    resolvedQuery: 'silver mein dikhao',
    intent: { ...baseIntent(), filters: { category: 'Glass Bangles', color: 'Silver', maxPrice: 1000 } },
    shownProductIds: ['p3'],
    selectedProductId: 'p2',
    cart: [],
  });
  assert.deepEqual(next.lastShownProductIds, ['p3']);
  assert.equal(next.filters.color, 'Silver');
  assert.ok(next.updatedAt);
  assert.ok(salesMemoryPromptContext(next, products).includes('Selected product: Gold Glass Bangles'));
}

const clientImage = await readFile(new URL('../lib/salaarClientImage.ts', import.meta.url), 'utf8');
assert.ok(clientImage.includes('MAX_EDGE = 1280'));
assert.ok(clientImage.includes("'image/webp'"));
assert.ok(clientImage.includes('WEBP_QUALITY = 0.72'));

const r2 = await readFile(new URL('../lib/r2.ts', import.meta.url), 'utf8');
assert.ok(r2.includes('compressSalaarImageForR2'));
assert.ok(r2.includes('width: 1024'));
assert.ok(r2.includes('quality: 72'));

const widget = await readFile(new URL('../components/SalaarNative.tsx', import.meta.url), 'utf8');
assert.ok(widget.includes('compressSalaarImageBeforeUpload'));
assert.ok(widget.includes('MEMORY_KEY'));
assert.ok(widget.includes('cartContext'));

const chatRoute = await readFile(new URL('../app/api/salaar/chat/route.ts', import.meta.url), 'utf8');
assert.ok(chatRoute.includes('resolveSalesTurnWithMemory'));
assert.ok(chatRoute.includes('salesMemoryPromptContext'));
assert.ok(chatRoute.includes('saveStoredMemory'));

const liveRoute = await readFile(new URL('../app/api/salaar/live/route.ts', import.meta.url), 'utf8');
assert.ok(liveRoute.includes('pendingSalesMemory'));
assert.ok(liveRoute.includes('pendingCartContext'));

console.log('Salaar Phase 6 sales memory smoke: PASS');
