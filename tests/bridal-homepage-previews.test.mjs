import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'lib/bridalHomepagePreviews.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { bridalHomepagePreviews, BRIDAL_RED_PRODUCT_ID, BRIDAL_MEHROON_PRODUCT_ID } =
  await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(compiled));

const redUrl = 'https://pub-157b90419bf04016bdea666e4cbce181.r2.dev/products/red.webp';
const newRedUrl = 'https://images.primehubmall.com/products/bangles-nov24/bridal-01-9a2c1345d256.webp';
const newMehroonUrl = 'https://images.primehubmall.com/products/bangles-nov24/bridal-02-34a9995668c1.webp';

test('homepage bridal rail shows existing bright red then original mehroon photo', () => {
  const red = { id: BRIDAL_RED_PRODUCT_ID, title: 'Red Bridal Chura', imageUrl: redUrl, images: [redUrl] };
  const newer = { id: BRIDAL_MEHROON_PRODUCT_ID, title: 'Red Bridal Chura with Kalire', imageUrl: newRedUrl, images: [newRedUrl, newMehroonUrl] };
  const ordered = bridalHomepagePreviews([newer, red], 'Bridal collection');
  assert.deepEqual(ordered.map(x => x.id), [BRIDAL_RED_PRODUCT_ID, BRIDAL_MEHROON_PRODUCT_ID]);
  assert.equal(ordered[0].imageUrl, redUrl);
  assert.equal(ordered[1].imageUrl, newMehroonUrl);
  assert.equal(ordered[1].images[0], newRedUrl, 'product gallery remains untouched');
  assert.equal(newer.imageUrl, newRedUrl, 'do not mutate global product catalog');
});

test('without both real source images, do not invent a color or new card', () => {
  const onlyRed = [{id: BRIDAL_RED_PRODUCT_ID, title:'Red', imageUrl:redUrl}];
  assert.deepEqual(bridalHomepagePreviews(onlyRed, 'Bridal collection'), onlyRed);
  const missingMehroon = [
    onlyRed[0], {id:BRIDAL_MEHROON_PRODUCT_ID,title:'Bridal',images:[newRedUrl]},
  ];
  assert.deepEqual(bridalHomepagePreviews(missingMehroon, 'Bridal collection'), missingMehroon);
});

test('all other homepage categories stay unmodified', () => {
  const catalog = [
    {id:BRIDAL_RED_PRODUCT_ID,title:'Red',imageUrl:redUrl},
    {id:BRIDAL_MEHROON_PRODUCT_ID,title:'Bridal',images:[newRedUrl,newMehroonUrl]},
  ];
  assert.equal(bridalHomepagePreviews(catalog, 'Glass bangles'), catalog);
});

test('category component uses a stable two-colour row only for Bridal Collection', () => {
  const page = fs.readFileSync(path.join(root,'components/home/HomeCategoryDeals.tsx'),'utf8');
  assert.match(page,/bridalHomepagePreviews\(matches, category\.title\)/);
  assert.match(page,/useVisitProductOrder\(products, namespace, railRef, !fixedOrder\)/);
  assert.match(page,/enabled: !fixedOrder/);
  assert.match(page,/!fixedOrder && allCategoryProductsVisible/);
});

test('separate mehroon preview uses original photo, owner-confirmed 30 stock and distinct ID', async () => {
  const compiledSplit = ts.transpileModule(fs.readFileSync(path.join(root,'lib/bridalSplitPreview.ts'),'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const { previewBridalCatalog, BRIDAL_SOURCE_ID, BRIDAL_DRAFT_ID } = await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(compiledSplit));
  const original = {id: BRIDAL_SOURCE_ID, title: 'Red Bridal', price:900, stock:30, images:[newRedUrl,newMehroonUrl]};
  assert.deepEqual(previewBridalCatalog([original],false),[original]);
  const [red, mehroon] = previewBridalCatalog([original],true);
  assert.equal(red.id,BRIDAL_SOURCE_ID);
  assert.deepEqual(red.images,[newRedUrl]);
  assert.equal(mehroon.id,BRIDAL_DRAFT_ID);
  assert.deepEqual(mehroon.images,[newMehroonUrl]);
  assert.equal(mehroon.price,900);
  assert.equal(mehroon.stock,30);
  assert.equal(mehroon.quantity,30);
  assert.equal(original.images.length,2);
  assert.equal(previewBridalCatalog([red,mehroon],true).length,2);
});
