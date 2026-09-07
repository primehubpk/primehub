import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const sourceUrl = new URL('../lib/salaarSalesIntent.ts', import.meta.url);
const source = (await readFile(sourceUrl, 'utf8')).replace(/^import 'server-only';\s*/m, '');
const transpiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`;
const { parseSalesIntent, rankProductsForIntent, intentNeedsLlm } = await import(moduleUrl);

const catalog = {
  categories: [
    { id: 'glass', name: 'Glass Bangles', slug: 'glass-bangles' },
    { id: 'metal', name: 'Metal Bangles', slug: 'metal-bangles' },
  ],
  priceBuckets: [
    { id: 'bucket-99', label: '99', maxPrice: 99 },
    { id: 'under-299', label: 'Under 299', maxPrice: 299 },
    { id: 'wholesale-bucket', label: 'Wholesale Deal', type: 'wholesale' },
  ],
  products: [
    { id: 'g99', title: 'Red Glass Bangles', category: 'Glass Bangles', price: 99, originalPrice: 149, stock: 10, published: true, active: true, priceBucketIds: ['bucket-99', 'under-299'], createdAt: '2026-08-01T10:00:00Z' },
    { id: 'g199', title: 'Green Glass Bangles', category: 'Glass Bangles', price: 199, originalPrice: 199, stock: 0, published: true, active: true, priceBucketIds: ['under-299'], createdAt: '2026-08-20T10:00:00Z' },
    { id: 'g249', title: 'Blue Glass Bangles New', category: 'Glass Bangles', price: 249, originalPrice: 499, stock: 7, published: true, active: true, priceBucketIds: ['under-299'], createdAt: '2026-09-05T10:00:00Z' },
    { id: 'm1200', title: 'Metal Premium Set', category: 'Metal Bangles', price: 1200, originalPrice: 1500, stock: 5, published: true, active: true, priceBucketIds: [], createdAt: '2026-07-01T10:00:00Z' },
    { id: 'w1800', title: 'Wholesale Metal Box', category: 'Metal Bangles', price: 1800, originalPrice: 2500, stock: 20, published: true, active: true, isWholesale: true, priceBucketIds: ['wholesale-bucket'], createdAt: '2026-08-15T10:00:00Z' },
    { id: 'hidden', title: 'Hidden Product', category: 'Glass Bangles', price: 50, stock: 20, published: false, active: true, priceBucketIds: ['bucket-99'], createdAt: '2026-09-06T10:00:00Z' },
  ],
};

function ids(items) { return items.map((item) => item.id); }

{
  const intent = parseSalesIntent('99 wali products dikhao', catalog);
  assert.equal(intent.filters.priceBucketId, 'bucket-99');
  assert.equal(intent.filters.maxPrice, 99);
  assert.deepEqual(ids(rankProductsForIntent(catalog.products, intent, [])), ['g99']);
}

{
  const intent = parseSalesIntent('wholesale deal products dikhao', catalog);
  assert.equal(intent.filters.priceBucketId, 'wholesale-bucket');
  assert.equal(intent.filters.wholesaleOnly, true);
  assert.deepEqual(ids(rankProductsForIntent(catalog.products, intent, [])), ['w1800']);
}

{
  const intent = parseSalesIntent('latest glass bangles dikhao', catalog);
  assert.equal(intent.sortBy, 'latest');
  assert.deepEqual(ids(rankProductsForIntent(catalog.products, intent, [])), ['g249', 'g199', 'g99']);
}

{
  const intent = parseSalesIntent('sab se sasti glass bangles dikhao', catalog);
  assert.equal(intent.sortBy, 'cheapest');
  assert.deepEqual(ids(rankProductsForIntent(catalog.products, intent, [])), ['g99', 'g199', 'g249']);
}

{
  const intent = parseSalesIntent('in stock glass bangles dikhao', catalog);
  assert.equal(intent.filters.inStockOnly, true);
  assert.deepEqual(ids(rankProductsForIntent(catalog.products, intent, [])), ['g99', 'g249']);
}

{
  const intent = parseSalesIntent('best discount glass bangles dikhao', catalog);
  assert.equal(intent.sortBy, 'discount');
  assert.deepEqual(ids(rankProductsForIntent(catalog.products, intent, [])), ['g249', 'g99']);
}

{
  const intent = parseSalesIntent('is image jaisa design dhoondo', catalog);
  assert.equal(intent.requiresVision, true);
  assert.equal(intentNeedsLlm(intent), true);
}

{
  const intent = parseSalesIntent('latest glass bangles dikhao', catalog);
  assert.deepEqual(ids(rankProductsForIntent(catalog.products, intent, ['g249'])), ['g199', 'g99']);
}

console.log('Salaar Phase 4 smart search smoke: PASS');
