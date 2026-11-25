import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const helperPath = path.join(root, 'lib/newArrivalsOrder.ts');
const source = fs.readFileSync(helperPath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { orderNewArrivals } = await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(compiled));

test('new arrivals uses original createdAt, not later edits, and includes every valid product', () => {
  const products = [
    { id: 'old', title: 'First product', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-12-01T00:00:00Z' },
    { id: 'new', title: 'Newest product', createdAt: '2026-11-25T00:00:00Z' },
    { id: 'mid', title: 'Middle product', createdAt: '2026-06-01T00:00:00Z' },
  ];
  assert.deepEqual(orderNewArrivals(products).map(p => p.id), ['new', 'mid', 'old']);
  assert.deepEqual(products.map(p => p.id), ['old', 'new', 'mid'], 'do not reorder incoming shared catalog');
});

test('wholesale and older products remain on the same separate arrivals page', () => {
  const input = Array.from({ length: 150 }, (_, i) => ({
    id: 'id-' + i, name: 'Product ' + i,
    createdAt: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
    isWholesale: i % 4 === 0,
  }));
  const ordered = orderNewArrivals(input);
  assert.equal(ordered.length, 150);
  assert.equal(ordered[0].id, 'id-149');
  assert.equal(ordered.at(-1).id, 'id-0');
  assert.equal(ordered.filter(p => p.isWholesale).length, input.filter(p => p.isWholesale).length);
});

test('filters unpublished and inactive items without creating duplicates', () => {
  const result = orderNewArrivals([
    { id:'a', title:'A', createdAt:'2026-11-25' },
    { id:'a', title:'A duplicated', createdAt:'2026-11-25' },
    { id:'off', title:'Off', published:false },
    { id:'inactive', title:'Inactive', active:false },
    { id:'missing', title:'' },
  ]);
  assert.deepEqual(result.map(p=>p.id), ['a']);
});

test('Firestore Timestamp and missing dates are sorted deterministically', () => {
  const sorted = orderNewArrivals([
    { id:'b', title:'B' },
    { id:'a', title:'A' },
    { id:'seconds', title:'C', createdAt:{seconds:1785000000} },
    { id:'millis', title:'D', createdAt:{toMillis:()=>1790000000000} },
  ]);
  assert.deepEqual(sorted.map(p=>p.id),['millis','seconds','b','a']);
});

test('dedicated arrivals page renders a single complete progressively loaded grid', () => {
  const page = fs.readFileSync(path.join(root, 'app/new-arrivals/NewArrivalsCatalog.tsx'), 'utf8');
  const route = fs.readFileSync(path.join(root,'app/new-arrivals/page.tsx'), 'utf8');
  assert.match(page,/orderNewArrivals\(shop\.products\)/);
  assert.equal((page.match(/<CatalogProductGrid\b/g)||[]).length,1);
  assert.doesNotMatch(page,/\.slice\(0,\s*12\)|More to explore|All Products<\/h2>/);
  assert.match(route,/getPublicCatalogSnapshot/);
  assert.match(route,/canonical:\s*'\/new-arrivals'/);
  assert.match(page,/useShopCatalog\(undefined, '', initialProducts, initialCategories, true\)/);
  const catalogHook = fs.readFileSync(path.join(root, 'components/shop/useShopCatalog.ts'), 'utf8');
  assert.equal((catalogHook.match(/includeDedicatedDeals \|\| !isDedicatedDealProduct/g) || []).length, 3);
});
