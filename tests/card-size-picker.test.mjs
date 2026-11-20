import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = ts.transpileModule(fs.readFileSync('lib/cardSizeLabels.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { shortCardSize, cardSizeDescription, uniqueCardSizes } =
  await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(source));

test('size picker preserves exact stored variant identifiers and removes duplicates', () => {
  const raw = ['2.6 - Sawa 2 (Regular standard size)', '2.4 - Ponay 2', '2.6 - Sawa 2 (Regular standard size)', '', null];
  assert.deepEqual(uniqueCardSizes(raw), raw.slice(0, 2));
  assert.equal(shortCardSize(raw[0]), '2.6');
  assert.equal(shortCardSize('XL'), 'XL');
});
test('real size details take precedence and other categories never get invented bangle meanings', () => {
  assert.equal(cardSizeDescription('2.6 - Sawa 2 (Regular standard size)', 'Glass bangles'), '2.6 - Sawa 2 (Regular standard size)');
  assert.match(cardSizeDescription('2.6', 'Rainbow Bangles'), /Sawa 2/);
  assert.equal(cardSizeDescription('2.6', 'Shoes'), '2.6');
  assert.equal(cardSizeDescription('XL', 'Clothes'), 'XL');
});
test('Home, category, BOGO, arrivals and Shop reuse the same picker', () => {
  for (const p of ['components/home/HomeCollections.tsx','components/home/BogoDeals.tsx',
      'components/NewArrivalsRail.tsx','components/shop/CatalogProductCard.tsx']) {
    assert.match(fs.readFileSync(p, 'utf8'), /<CardSizePicker/);
  }
  assert.match(fs.readFileSync('components/home/HomeCategoryDeals.tsx','utf8'), /<HomeProductCard/);
  assert.match(fs.readFileSync('components/shop/CategoryRails.tsx','utf8'), /<CatalogProductCard/);
});
test('variant selections are passed into fresh product verification and modal, never fake stock', () => {
  const home = fs.readFileSync('components/home/HomeCollections.tsx','utf8');
  const bogo = fs.readFileSync('components/home/BogoDeals.tsx','utf8');
  const shop = fs.readFileSync('components/shop/useShopCatalog.ts','utf8');
  for (const s of [home, bogo, shop]) {
    assert.match(s, /getMegaDealAvailableSizes\(\w+\)\.includes\(selectedSize\)/);
    assert.match(s, /preferredSize: selectedSize \|\| undefined/);
  }
});
test('paused BOGO offers allow informational selection but keep purchases disabled', () => {
  const bogo = fs.readFileSync('components/home/BogoDeals.tsx','utf8');
  const css = fs.readFileSync('components/home/bogo-deals.css','utf8');
  assert.match(bogo, /category=\{String\(product\.category \|\| ''\)\} disabled=\{busy\}/);
  assert.match(bogo, /disabled=\{busy \|\| !available\}/);
  assert.match(css, /\.bogo-rail__group\{[^}]*align-items:flex-start/);
  assert.match(css, /\.bogo-card__link\{[^}]*flex:0 0 auto/);
});

test('catalog batches lightweight summaries and does not ship full variant matrices', () => {
  const server = fs.readFileSync('lib/publicCatalogServer.ts','utf8');
  assert.match(server, /for \(let i = 0; i < missingIds\.length; i \+= 75\)/);
  assert.match(server, /chunks\.slice\(i, i \+ 3\)/);
  assert.match(server, /'variantMatrix'/);
  assert.match(server, /availableSizes/);
});
