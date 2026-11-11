import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const source = await fs.readFile(path.join(root, 'lib/glassOffers.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const catalog = await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(compiled));
const { STARTER_GLASS_OFFERS, resolveGlassOffers, resolveGlassOfferProducts } = catalog;

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
