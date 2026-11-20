import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = ts.transpileModule(fs.readFileSync('lib/cardSizeLabels.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { shortCardSize, cardSizeDescription, uniqueCardSizes, getCardSizeOptions, hasMismatchedHandSizes } =
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

test('wrong baby hand sizes are never presented on jhola, socks, shoes or clothes', () => {
  const wrong = ['8 number — 1–3 year baby, normal hand', '10 number — 3–5 year baby, normal hand', '12 number — 5–8 year baby, normal hand'];
  for (const [title, category] of [
    ['Baby Jhola Kids Swing - Indoor Toddler Jhula', 'Kids swing'],
    ['New Born Baby 0 To 1 Year Socks Pack', 'Kids Garments'],
    ['Warm Winter Soft Fleece Booties for Kids - Brown', 'Kids shoes'],
    ['White Cartoon Kids Sweatshirt with Yellow Joggers', 'Kids Garments'],
  ]) {
    const product = { title, category, availableSizes: wrong };
    assert.equal(hasMismatchedHandSizes(product), true, title);
    assert.deepEqual(getCardSizeOptions(product), [], title);
  }
  const valid = { title:'Kids Glass Bangles', category:'Kids Bangles', availableSizes:wrong };
  assert.equal(hasMismatchedHandSizes(valid), false);
  assert.deepEqual(getCardSizeOptions(valid), wrong);
  assert.deepEqual(getCardSizeOptions({ title: 'Traditional Bridal Red Chura Set with Designer Gold Kadas', category: 'Bridal collection', availableSizes: ['2.6 - Sawa 2 (Regular standard size)'] }), ['2.6 - Sawa 2 (Regular standard size)']);
});
test('quantity, fixed pair and bundles do not masquerade as size options', () => {
  for(const [title, category, size] of [
    ['Earrings Pair','Jewellery Collection','One pair'],
    ['Henna Pack','Bridal mehendi','Mehndi Box — 12 Pieces'],
    ['Adjustable Bracelet','jewellery Bangles','Girls Bracelet — Openable / Adjustable / Fits most hands'],
    ['Bangles Wholesale Pack','Wholesale','Mix Size Box — 2.6 / 2.4 / 2.8'],
    ['Bangles Pack','Wholesale','3 Packs — Mix Sizes — 9 Dozen Total'],
  ]) {
    assert.deepEqual(getCardSizeOptions({title,category,availableSizes:[size]}),[],title);
  }
  assert.deepEqual(getCardSizeOptions({title:'Glitter Bangles',category:'Glass bangles',availableSizes:['2.2','2.4','2.6']}),['2.2','2.4','2.6']);
  assert.deepEqual(getCardSizeOptions({title:'Kids T-shirt',category:'Kids Garments',availableSizes:['S','M','L']}),['S','M','L']);
});
test('invalid size choices cannot open checkout variant selectors on any purchase path', () => {
  for(const file of ['lib/verifiedDealProduct.ts','components/shop/useShopCatalog.ts','components/product-detail/useProductDetail.ts']){
    assert.match(fs.readFileSync(file,'utf8'),/hasMismatchedHandSizes\(/,file);
  }
});
