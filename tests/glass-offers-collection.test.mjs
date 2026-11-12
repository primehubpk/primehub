import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const source = await fs.readFile(path.join(root, 'lib/glassOffers.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const catalog = await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(compiled));
const { STARTER_GLASS_OFFERS, resolveGlassOffers, resolveGlassOfferProducts, isExclusiveGlassDealProduct } = catalog;

test('the original featured collection has 12 real unique product IDs', () => {
  assert.equal(STARTER_GLASS_OFFERS.length, 12);
  assert.equal(new Set(STARTER_GLASS_OFFERS.map(item => item.productId)).size, 12);
  assert.ok(STARTER_GLASS_OFFERS.every(item => item.referencePrice === 3000));
});

test('deal cards use real product prices, not a hardcoded Rs. 999 cap', () => {
  const products = [
    { id: 'premium', title: 'Gold Wedding Set', price: 2499, originalPrice: 3999, active: true },
    { id: 'budget', title: 'Rainbow Box', price: 999, originalPrice: 999, active: true },
    { id: 'disabled', title: 'Hidden', price: 99, active: false },
  ];
  const opts = { enabled: true, heading: 'Offers', subtitle: '', badge: 'Offers', items: [
    { productId: 'premium' }, { productId: 'budget', referencePrice: 3000 }, { productId: 'disabled' },
  ] };
  const offers = resolveGlassOfferProducts(products, opts);
  assert.equal(offers.length, 2);
  assert.equal(offers[0].price, 2499);
  assert.equal(offers[0].referencePrice, 3999);
  assert.equal(offers[1].price, 999);
  assert.equal(offers[1].savingPercent, 67);
});

test('admin settings can hide the collection and remove products without fallback', () => {
  const config = resolveGlassOffers({ enabled: false, items: [] });
  assert.equal(config.enabled, false);
  assert.deepEqual(config.items, []);
  assert.deepEqual(resolveGlassOfferProducts([{ id: 'x', price: 100 }], config), []);
});

test('duplicated IDs are removed and invalid references are not shown as discounts', () => {
  const config = resolveGlassOffers({ items: [{ productId: 'a', referencePrice: 200 }, { productId: 'a', referencePrice: 400 }] });
  assert.equal(config.items.length, 1);
  const offers = resolveGlassOfferProducts([{ id: 'a', title: 'Bangles', price: 450, originalPrice: 450 }], config);
  assert.equal(offers[0].referencePrice, 0);
  assert.equal(offers[0].savingPercent, 0);
});

test('home placement stays after weekly deals and before Big Deal', async () => {
  const home = await fs.readFile(path.join(root, 'components/HeroFlashBanner.tsx'), 'utf8');
  const weekly = home.indexOf('id="weekly-deals"');
  const showcase = home.indexOf('<HomeGlassOfferRail');
  const big = home.indexOf('{bigDeal?.active && bigDeal.title && (() => {');
  assert.ok(weekly >= 0 && showcase > weekly && big > showcase);
});

test('landing page and admin manager are wired to the same collection setting', async () => {
  const page = await fs.readFile(path.join(root, 'app/deals/glass-bangles/page.tsx'), 'utf8');
  const admin = await fs.readFile(path.join(root, 'components/admin/settings/GlassDealShowcaseSettings.tsx'), 'utf8');
  assert.match(page, /glassDealShowcase/);
  assert.match(admin, /glassDealShowcase/);
  assert.match(admin, /setAdminDocument\('settings', 'main'/);
});

test('all twelve original offer listings are exclusive to the offers page', () => {
  assert.equal(STARTER_GLASS_OFFERS.filter(item => isExclusiveGlassDealProduct(item.productId)).length, 12);
  assert.equal(isExclusiveGlassDealProduct({ id: STARTER_GLASS_OFFERS[0].productId }), true);
  assert.equal(isExclusiveGlassDealProduct('unrelated-product'), false);
});

test('normal Shop, category, New Arrivals, and Sale Mela exclude exclusive offers', async () => {
  const [category, catalogHook, arrivals, collections, home] = await Promise.all([
    fs.readFile(path.join(root, 'lib/categoryUtils.ts'), 'utf8'),
    fs.readFile(path.join(root, 'components/shop/useShopCatalog.ts'), 'utf8'),
    fs.readFile(path.join(root, 'components/NewArrivalsRail.tsx'), 'utf8'),
    fs.readFile(path.join(root, 'components/home/HomeCollections.tsx'), 'utf8'),
    fs.readFile(path.join(root, 'components/HomePageClient.tsx'), 'utf8'),
  ]);
  for (const source of [category, catalogHook, arrivals, collections, home]) {
    assert.match(source, /isExclusiveGlassDealProduct/);
  }
  assert.match(home, /initialProducts=\{regularProducts\}/);
  assert.match(home, /<HomeCategoryDealsLazy products=\{regularProducts\}/);
  assert.match(home, /<HomeDiscoverDealsLazy products=\{regularProducts\}/);
});

test('mobile offer header uses compact icon without large heading, with View More immediately above the rail', async () => {
  const rail = await fs.readFile(path.join(root, 'components/home/HomeGlassOfferRail.tsx'), 'utf8');
  const css = await fs.readFile(path.join(root, 'components/home/glass-offers.css'), 'utf8');
  assert.ok(rail.indexOf('glass-offers-home__more') < rail.indexOf('glass-offers-home__row'));
  assert.doesNotMatch(rail, /glass-offers-home__heading-copy/);
  assert.match(rail, /<strong>\{config.badge\}<\/strong>/);
  assert.match(css, /width:70px;min-width:70px/);
  assert.match(css, /width:100px;min-width:100px/);
});

test('Select Size verifies live product and opens existing modal, with five second swipe pause', async () => {
  const card = await fs.readFile(path.join(root, 'components/home/GlassOfferCard.tsx'), 'utf8');
  const hook = await fs.readFile(path.join(root, 'lib/useContinuousHomeRail.ts'), 'utf8');
  assert.match(card, /getVerifiedDealProduct\(product.id\)/);
  assert.match(card, /openVariantModal\(\{ \.\.\.fresh/);
  assert.match(card, /Select Size/);
  assert.match(hook, /resumeAfterMs = 5000/);
  assert.match(hook, /onPointerDown/);
});
