import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
const code = ts.transpileModule(fs.readFileSync('lib/megaRecommendations.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { selectMegaRecommendations } = await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(code));

test('Mega recommendations stay within configured offers and prefer the current category', () => {
  const current = { id: 'box', category: 'Glass Bangles' };
  const offers = [
    { product: current, price: 1209 },
    { product: { id: 'matching', category: 'glass bangles' }, price: 999 },
    { product: { id: 'bag', category: 'Bags' }, price: 2000 },
    { product: { id: 'hidden', category: 'Glass Bangles', published: false }, price: 999 },
    { product: { id: 'inactive', category: 'Glass Bangles', active: false }, price: 999 },
  ];
  const before = structuredClone(offers);
  assert.deepEqual(selectMegaRecommendations(current, offers).map(x => x.product.id), ['matching']);
  assert.deepEqual(offers, before);
});

test('a category with no other Mega offers uses the remaining active Mega collection', () => {
  const offers = [
    { product: { id: 'bag', category: 'Bags' }, price: 100 },
    { product: { id: 'watch', category: 'Watches' }, price: 150 },
  ];
  assert.deepEqual(selectMegaRecommendations({ id: 'bag', category: 'Bags' }, offers).map(x => x.product.id), ['watch']);
  assert.deepEqual(selectMegaRecommendations({ id: 'bag', category: '' }, offers).map(x => x.product.id), ['watch']);
});

test('disabled or empty offer collections never invent substitute products', () => {
  assert.deepEqual(selectMegaRecommendations({ id: 'box' }, []), []);
  assert.deepEqual(selectMegaRecommendations({ id: 'only' }, [{ product: { id: 'only' }, price: 100 }]), []);
});

test('direct links load the shared catalog once; existing Home catalog is reused', async () => {
  for (const hasCatalog of [false, true]) {
    let fetches = 0, writes = 0, hook = 0;
    const effects = [], states = [];
    const current = { id: 'box', category: 'Glass', megaDealPrice: 100 };
    let cache = [current];
    const exports = {};
    const source = ts.transpileModule(fs.readFileSync('components/RecentlyViewed.tsx', 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    vm.runInNewContext(source, { exports, localStorage: { getItem: () => '[]' }, require: name => {
      if (name === 'react') return { useState: value => { const index = hook++; return [value, next => { states[index] = next; }]; }, useEffect: fn => effects.push(fn), useMemo: fn => fn() };
      if (name === 'react/jsx-runtime') return { jsx: () => null, jsxs: () => null };
      if (name === '@/lib/useSettings') return { useSettings: () => ({ settings: {} }) };
      if (name === '@/lib/glassOffers') return { resolveGlassOfferProducts: () => [], isExclusiveGlassDealProduct: () => false };
      if (name === '@/lib/productNavigationCache') return {
        loadProductsForNavigation: async () => ({ box: current }), readCachedProduct: () => current,
        readCachedProducts: () => cache, readCachedCatalog: () => hasCatalog ? { products: cache } : null,
        cacheCatalogForNavigation: products => { writes++; cache = products; },
      };
      if (name === '@/lib/storefrontClient') return { fetchPublicStorefront: async type => {
        assert.equal(type, 'catalog'); fetches++;
        return { ok: true, json: async () => ({ products: [current, { id: 'other' }], categories: [] }) };
      } };
      return {};
    } });
    exports.default({ excludeId: 'box' });
    effects[0]();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(fetches, hasCatalog ? 0 : 1);
    assert.equal(writes, hasCatalog ? 0 : 1);
    assert.equal(states[2], current);
    assert.equal(states[1].length, hasCatalog ? 1 : 2);
  }
});

test('only the reviewed landscape Mega photo gets its own wide uncropped frame', async () => {
  const source = ts.transpileModule(fs.readFileSync('lib/megaImagePresentation.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const { megaImageNeedsWideBackdrop } = await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(source));
  const photo = 'https://images.primehubmall.com/products/1795103525267-file_00000000cd20820bbdfb543ae9eaf6c9.webp';
  assert.equal(megaImageNeedsWideBackdrop('1qABfsZcsw66eDYTmeMJ', photo), true);
  assert.equal(megaImageNeedsWideBackdrop('other-product', photo), false);
  assert.equal(megaImageNeedsWideBackdrop('1qABfsZcsw66eDYTmeMJ', 'https://images.primehubmall.com/products/replaced-by-admin.webp'), false);
  const card = fs.readFileSync('components/home/GlassOfferCard.tsx', 'utf8');
  const css = fs.readFileSync('components/home/glass-offers.css', 'utf8');
  assert.match(card, /wideRecommendationImage = recommendation && !trimImage/);
  assert.match(card, /data-mega-wide=\{wideRecommendationImage/);
  assert.match(card, /glass-offer-card--wide/);
  assert.doesNotMatch(card, /glass-offer-card__wide-backdrop/);
  assert.match(css, /\.glass-offer-card--recommendation \.glass-offer-card__image--wide\s*\{\s*aspect-ratio:4\/3/);
  assert.match(css, /\.glass-offer-card--recommendation\.glass-offer-card--wide/);
  assert.match(css, /min-width:290px; align-self:flex-start/);
  assert.match(css, /\.glass-offer-card__image--wide \.glass-offer-card__wide-main/);
});
