import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const compile = text => ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const text = await fs.readFile(path.join(root, 'lib/glassOffers.ts'), 'utf8');
const moduleUrl = 'data:text/javascript;charset=utf-8,' + encodeURIComponent(compile(text));
const { STARTER_GLASS_OFFERS, resolveGlassOffers, resolveGlassOfferProducts, isExclusiveGlassDealProduct, resolveUnifiedDealCollection, unifyStorefrontDeals, applyCollectionPrice } = await import(moduleUrl);
const benefits = compile(await fs.readFile(path.join(root, 'lib/orderBenefits.ts'), 'utf8')).replace("from './glassOffers'", 'from ' + JSON.stringify(moduleUrl));
const { orderEligibleSubtotal } = await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(benefits));
const legacy = {
  weeklyDeals: [{ productId: 'weekly', active: true, day: 'friday', dealPrice: 190, originalPrice: 299 }],
  bigDeal: { active: true, productIds: ['watch', 'bag'], dealPrices: [999, 500], originalPrices: [3000, 1500], productId: 'watch' },
};
const products = [
  { id: 'weekly', title: 'Weekly product', price: 299, originalPrice: 299, category: 'Jewellery', active: true },
  { id: 'watch', title: 'Watch', price: 3000, originalPrice: 3000, category: 'Watches', active: true, variantMatrix: [{ size: 'One size', price: 3000, stock: 4 }] },
  { id: 'bag', title: 'Bag', price: 1500, originalPrice: 1500, category: 'Bags', active: true },
];

test('original twelve IDs stay unique and preserve their documented references', () => {
  assert.equal(STARTER_GLASS_OFFERS.length, 12);
  assert.equal(new Set(STARTER_GLASS_OFFERS.map(item => item.productId)).size, 12);
  assert.ok(STARTER_GLASS_OFFERS.every(item => item.referencePrice === 3000 && isExclusiveGlassDealProduct(item.productId)));
});

test('migration includes all Weekly and Big slots at their exact advertised prices without rotation', () => {
  const config = resolveUnifiedDealCollection(legacy);
  assert.equal(config.collectionVersion, 2);
  const offers = resolveGlassOfferProducts(products, config);
  assert.deepEqual(offers.map(item => [item.product.id, item.price]), [['weekly', 190], ['watch', 999], ['bag', 500]]);
  assert.equal(offers[0].savingPercent, 36);
  assert.equal(offers[1].savingPercent, 67);
});

test('normalization is idempotent, retires all schedules, and never mutates source documents', () => {
  const before = structuredClone(legacy);
  const normalized = unifyStorefrontDeals(legacy);
  assert.deepEqual(normalized.weeklyDeals, []);
  assert.equal(normalized.bigDeal.active, false);
  assert.deepEqual(unifyStorefrontDeals(normalized), normalized);
  assert.deepEqual(legacy, before);
  assert.equal(normalized.glassDealShowcase.items.find(item => item.productId === 'bag').dealPrice, 500);
});

test('dedicated Big Deal wins over an obsolete daily alias; no duplicate IDs', () => {
  const config = resolveUnifiedDealCollection({ ...legacy, dailyDeal: { active: true, productId: 'obsolete', dealPrice: 1 } });
  assert.equal(new Set(config.items.map(item => item.productId)).size, config.items.length);
  assert.ok(!config.items.some(item => item.productId === 'obsolete'));
});

test('legacy daily-only settings are migrated and inactive old selections are omitted', () => {
  const config = resolveUnifiedDealCollection({ weeklyDeals: [{ productId: 'hidden', active: false }], dailyDeal: { active: true, productId: 'daily', dealPrice: 99, originalPrice: 499 } });
  assert.equal(config.items.find(item => item.productId === 'daily').dealPrice, 99);
  assert.ok(!config.items.some(item => item.productId === 'hidden'));
});

test('explicit saved lists can remove migrated products and stay empty without reappearing', () => {
  const config = resolveUnifiedDealCollection({ ...legacy, glassDealShowcase: { collectionVersion: 2, enabled: true, items: [] } });
  assert.deepEqual(config.items, []);
});

test('disabled collection leaves actual catalog and variant prices untouched', () => {
  const config = { ...resolveUnifiedDealCollection(legacy), enabled: false };
  assert.deepEqual(resolveGlassOfferProducts(products, config), []);
  assert.equal(applyCollectionPrice(products[1], config), products[1]);
});

test('all selected variants keep migrated selling price without modifying original stock or IDs', () => {
  const before = structuredClone(products[1]);
  const priced = applyCollectionPrice(products[1], resolveUnifiedDealCollection(legacy));
  assert.equal(priced.price, 999);
  assert.equal(priced.variantMatrix[0].price, 999);
  assert.equal(priced.variantMatrix[0].stock, 4);
  assert.equal(priced.id, 'watch');
  assert.deepEqual(products[1], before);
});

test('new collection products may use catalog prices or an explicit selling price', () => {
  const config = { collectionVersion: 2, items: [{ productId: 'bag' }, { productId: 'watch', dealPrice: 799 }] };
  assert.equal(applyCollectionPrice(products[2], config).price, 1500);
  assert.equal(applyCollectionPrice(products[1], config).price, 799);
  assert.equal(applyCollectionPrice({ id: 'regular', price: 200 }, config).price, 200);
});

test('invalid references, prices and duplicate IDs cannot create fake discounts', () => {
  const config = resolveGlassOffers({ items: [{ productId: 'watch', dealPrice: Infinity, referencePrice: -1 }, { productId: 'watch', referencePrice: 10000 }] });
  assert.equal(config.items.length, 1);
  assert.equal(config.items[0].dealPrice, undefined);
  const offers = resolveGlassOfferProducts([{ id: 'watch', price: 450, originalPrice: 450 }], config);
  assert.equal(offers[0].savingPercent, 0);
  assert.equal(offers[0].referencePrice, 0);
});

test('unpublished and inactive products never appear as orderable deals', () => {
  const config = resolveUnifiedDealCollection(legacy);
  assert.deepEqual(resolveGlassOfferProducts(products.map(item => ({ ...item, published: false })), config), []);
  assert.deepEqual(resolveGlassOfferProducts(products.map(item => ({ ...item, active: false })), config), []);
});

test('unified deals cannot stack benefits; mixed-cart benefits apply to regular products only', () => {
  const settings = unifyStorefrontDeals(legacy);
  assert.equal(orderEligibleSubtotal([{ productId: 'weekly', price: 190, quantity: 2 }, { productId: 'bag', price: 500, quantity: 1 }, { productId: 'regular', price: 300, quantity: 2 }], settings), 600);
});

test('homepage has one campaign with banner above swipe row and shared six-second pause', async () => {
  const home = await fs.readFile(path.join(root, 'components/HomePageClient.tsx'), 'utf8');
  const rail = await fs.readFile(path.join(root, 'components/home/HomeGlassOfferRail.tsx'), 'utf8');
  const hook = await fs.readFile(path.join(root, 'lib/useContinuousHomeRail.ts'), 'utf8');
  assert.doesNotMatch(home, /<HeroFlashBanner|<BigDealNextPreviewSync/);
  assert.match(home, /<HomeGlassOfferRail/);
  assert.ok(rail.indexOf('<MegaDealsHero') < rail.indexOf('className="glass-offers-home__viewport"'));
  assert.match(hook, /resumeAfterMs = 6000/);
});

test('old customer links all reach the unified deals page', async () => {
  for (const file of ['app/weekly-deals/page.tsx', 'app/deals/big/page.tsx', 'app/deals/[day]/page.tsx', 'app/deals/glass-bangles/page.tsx']) {
    assert.match(await fs.readFile(path.join(root, file), 'utf8'), /redirect\('\/deals'\)/);
  }
});

test('new admin collection edits retain migrated deal prices on save', async () => {
  const admin = await fs.readFile(path.join(root, 'components/admin/settings/GlassDealShowcaseSettings.tsx'), 'utf8');
  assert.match(admin, /resolveUnifiedDealCollection/);
  assert.match(admin, /collectionVersion: 2/);
  assert.match(admin, /dealPrice:/);
  assert.match(admin, /setAdminDocument\('settings', 'main'/);
});

test('slow auto-scroll accumulates subpixel motion and respects hold plus six seconds idle', async () => {
  const vm = await import('node:vm');
  const callbacks = [], events = new Map();
  let clock = 0, scroll = 0, cleanup;
  const rail = { clientWidth: 300,
    querySelector: selector => ({ offsetLeft: selector.includes('original') ? 0 : 1000 }),
    addEventListener: (name, fn) => events.set(name, fn), removeEventListener() {},
  };
  Object.defineProperty(rail, 'scrollLeft', { get: () => scroll, set: value => { scroll = Math.round(value); } });
  const exports = {};
  const code = ts.transpileModule(await fs.readFile(path.join(root, 'lib/useContinuousHomeRail.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports,
    require: () => ({ useRef: value => ({ current: value }), useEffect: callback => { cleanup = callback(); } }),
    window: { matchMedia: () => ({ matches: false }), requestAnimationFrame: fn => { callbacks.push(fn); return callbacks.length; }, cancelAnimationFrame() {},
      addEventListener: (name, fn) => events.set(name, fn), removeEventListener() {} },
    document: { visibilityState: 'visible' }, performance: { now: () => clock },
    IntersectionObserver: class { constructor(fn) { this.fn = fn; } observe() { this.fn([{ isIntersecting: true }]); } disconnect() {} },
  });
  exports.useContinuousHomeRail({ current: rail }, { itemCount: 26, speed: 24 });
  const frames = count => { for (let i = 0; i < count; i++) { clock += 1000 / 60; callbacks.shift()(clock); } };
  frames(60);
  assert.ok(scroll >= 20, '24px/s must move even when each native assignment rounds to whole pixels');
  events.get('pointerdown')();
  const held = scroll;
  frames(60);
  assert.equal(scroll, held);
  events.get('pointerup')();
  frames(180);
  assert.equal(scroll, held);
  frames(240);
  assert.ok(scroll > held);
  cleanup();
});

test('home Mega, BOGO and New Arrivals rails keep native endless scrolling without a catalogue cap', async () => {
  const [mega, bogo, arrivals, bogoCss] = await Promise.all([
    'components/home/HomeGlassOfferRail.tsx',
    'components/home/BogoDeals.tsx',
    'components/NewArrivalsRail.tsx',
    'components/home/bogo-deals.css',
  ].map(name => fs.readFile(path.join(root, name), 'utf8')));
  assert.match(mega, /useContinuousHomeRail\(railRef/);
  assert.match(mega, /data-loop-original/);
  assert.match(mega, /data-loop-copy/);
  assert.match(bogo, /useContinuousHomeRail\(rail,\s*\{\s*enabled:\s*!landing/);
  assert.match(bogo, /\[0, 1\]\.map\(copy/);
  assert.match(bogo, /data-loop-original/);
  assert.match(bogo, /data-loop-copy/);
  assert.match(bogo, /pauseAutoScroll\.current\(\)/);
  assert.match(bogoCss, /\.bogo-rail__group/);
  assert.match(bogoCss, /scroll-snap-type:none/);
  assert.match(arrivals, /useContinuousHomeRail\(homeRailRef/);
  assert.match(arrivals, /newestFirst\(products, homeLayout\)/);
  assert.doesNotMatch(arrivals, /homeLayout\s*\?\s*100/);
  assert.match(arrivals, /setHomeVisibleCount\(\(count\)\s*=>\s*Math\.min\(newest\.length,\s*count\s*\+\s*16\)\)/);
  assert.match(arrivals, /querySelector<HTMLElement>\('\[data-loop-copy\]'\)/);
});

test('Skills and Wholesale come directly after arrivals, with real-thumb 3D collection banners', async () => {
  const [home, commerce, css, share] = await Promise.all([
    'components/HomePageClient.tsx',
    'components/home/HomeCommerceRails.tsx',
    'components/home/HomeCommerceRails.css',
    'components/ProductShareButton.tsx',
  ].map(name => fs.readFile(path.join(root, name), 'utf8')));
  const order = ['<HomeGlassOfferRail','<BogoDeals','<NewArrivalsRail','<HomePrimeSkills','<HomeWholesaleVideos','<HomeCollections'];
  const positions = order.map(item => home.indexOf(item));
  assert.ok(positions.every(position => position >= 0));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
  assert.match(commerce, /Commerce3DBanner kind="wholesale"/);
  assert.match(commerce, /Commerce3DBanner kind="skills"/);
  assert.match(commerce, /videos\.map\(video => normalizeImageUrl\(thumbnailOf\(video\)\)\)/);
  assert.match(commerce, /skills\.map\(item => normalizeImageUrl\(item\.thumbnailUrl/);
  assert.match(commerce, /CollectionBannerActions path=\{href\}/);
  assert.match(css, /\.home-commerce-banner__emblem/);
  assert.match(css, /rotateY/);
  assert.match(share, /'\/wholesale-video-hub'\s*\|\s*'\/skills'/);
});

test('home rail spacing is compact without changing BOGO landing margins', async () => {
  const [megaCss, bogoCss, arrivalsCss] = await Promise.all([
    'components/home/glass-offers.css',
    'components/home/bogo-deals.css',
    'components/home/NewArrivalsPremium.css',
  ].map(name => fs.readFile(path.join(root, name), 'utf8')));
  assert.match(megaCss, /margin:14px auto 8px/);
  assert.match(bogoCss, /\.bogo-section:not\(\.bogo-section--landing\)\{margin-top:7px;margin-bottom:8px\}/);
  assert.match(arrivalsCss, /\.home-arrivals\{margin-top:8px\}/);
});

test('home rails retain visible server products while preparing visit order and gentle auto-motion', async () => {
  const names = [
    'lib/useVisitShuffled.ts',
    'lib/useContinuousHomeRail.ts',
    'components/home/HomeGlassOfferRail.tsx',
    'components/home/BogoDeals.tsx',
    'components/NewArrivalsRail.tsx',
    'components/home/HomeCollections.tsx',
    'components/home/HomeCategoryDeals.tsx',
  ];
  const [shuffle, motion, mega, bogo, arrivals, sale, category] = await Promise.all(
    names.map(name => fs.readFile(path.join(root, name), 'utf8')),
  );
  assert.ok(shuffle.includes('shuffleOnEntry = true'));
  assert.ok(shuffle.includes('!shuffleOnEntry || seed === null'));
  assert.ok(mega.includes("useVisitProductOrder(resolvedOffers, 'mega-home', railRef)"));
  assert.ok(bogo.includes("useVisitProductOrder(resolvedOffers, 'bogo-home', rail, !landing)"));
  for (const source of [mega, bogo, arrivals, sale, category]) {
    assert.ok(source.includes('aria-busy={!ready}'));
    assert.doesNotMatch(source, /visibility:\s*ready\s*\?/);
  }
  assert.ok(motion.includes('startDelayMs = 0'));
  for (const source of [mega, bogo, arrivals, sale, category]) {
    assert.ok(source.includes('startDelayMs: 8000'));
  }
  assert.ok(sale.includes('const saleShuffleSeed = stableCatalogSeed'));
  assert.ok(!sale.includes('setHomeShuffleSeed('));
  assert.ok(!category.includes('sessionRailSeed()'));
  assert.ok(!category.includes('setRefreshSeed('));
});

test('Sale Mela and every product category reuse premium 3D banners with real collection photos', async () => {
  const [home, sale, category, banner, share, css] = await Promise.all(
    ['components/HomePageClient.tsx', 'components/home/HomeCollections.tsx',
      'components/home/HomeCategoryDeals.tsx', 'components/home/HomeCommerceRails.tsx',
      'components/ProductShareButton.tsx', 'components/home/HomeCommerceRails.css']
      .map(name => fs.readFile(path.join(root, name), 'utf8')),
  );
  assert.ok(home.indexOf('<HomePrimeSkills') < home.indexOf('<HomeWholesaleVideos'));
  assert.ok(home.indexOf('<HomeWholesaleVideos') < home.indexOf('<HomeCollections'));
  assert.ok(home.indexOf('<HomeCollections') < home.indexOf('<HomeCategoryDealsLazy'));
  assert.equal((sale.match(/<Commerce3DBanner/g) || []).length, 1);
  assert.ok(sale.includes('onMove={direction => moveHomeSale(direction, anchor)}'));
  assert.ok(category.includes('Commerce3DBanner kind="category"'));
  assert.ok(category.includes('images={matches.map(product => normalizeImageUrl(imageOf(product)))}'));
  assert.ok(banner.includes('CollectionBannerActions path={href}'));
  assert.ok(share.includes("'/primehubmall/salemela'"));
  assert.ok(share.includes('/category/'));
  assert.ok(css.includes('.home-commerce-banner--sale'));
  assert.ok(css.includes('.home-commerce-banner--category'));
});

test('home Sale Mela ranges use shared clickable banners without duplicate browse headings', async () => {
  const [home, buckets] = await Promise.all([
    'components/home/HomeCollections.tsx', 'lib/priceBucketUtils.ts',
  ].map(name => fs.readFile(path.join(root, name), 'utf8')));
  assert.ok(home.includes("Commerce3DBanner kind={wholesale ? 'wholesale' : 'sale'}"));
  assert.ok(home.includes('hideHeader={!standalone || (embeddedHome && !wholesale)}'));
  assert.ok(home.includes('onMove={direction => moveHomeSale(direction, anchor)}'));
  assert.ok(home.includes("amount === 999 ? 'Rs. 999+' : saleMelaBucketLabel(amount)"));
  assert.equal((home.match(/<Commerce3DBanner/g) || []).length, 1);
  assert.match(buckets, /amount === 99\) return \{ minInclusive: 1, maxExclusive: 299 \}/);
  assert.match(buckets, /amount === 299\) return \{ minInclusive: 299, maxExclusive: 999 \}/);
  assert.match(buckets, /amount === 999\) return \{ minInclusive: 999, maxExclusive: null \}/);
});

test('home Sale Mela and category trails have one full-size row through all products without changing standalone grids', async () => {
  const [css, mega, category] = await Promise.all([
    'components/home/home.css',
    'components/home/glass-offers.css',
    'components/home/HomeCategoryDeals.tsx',
  ].map(name => fs.readFile(path.join(root, name), 'utf8')));
  assert.match(mega, /\.glass-offer-card--compact \.glass-offer-card__image \{ aspect-ratio:4\/5/);
  assert.match(css, /\.home-sale-home-frame \.home-product-image,\s*\.home-category-3d-frame \.home-product-image\s*\{\s*aspect-ratio:4\/5/);
  assert.match(css, /\.home-sale-home-frame \.home-add,\s*\.home-category-3d-frame \.home-add/);
  assert.match(css, /\.home-sale-home-frame \.home-product \.home-price/);
  assert.match(category, /data-home-category-rail/);
  assert.ok(category.includes("gridTemplateRows: 'repeat(1, auto)'"));
  assert.doesNotMatch(category, /products\.length % 2/);
  const sale = await fs.readFile(path.join(root, 'components/home/HomeCollections.tsx'), 'utf8');
  assert.ok(sale.includes('const visibleProducts = standalone ? products.slice(0, limit) : visitProducts;'));
  assert.ok(sale.includes('gridTemplateRows: \"repeat(1, auto)\"'));
  assert.ok(sale.includes('gridAutoColumns: "min(calc((100% - 10px) / 2), 208px)"'));
  assert.ok(category.includes("gridAutoColumns: 'min(calc((100% - 10px) / 2), 208px)'"));
  assert.match(css, /@media\(min-width:641px\)/);
});

const previewShuffleCode = compile(await fs.readFile(path.join(root, 'lib/shuffleProducts.ts'), 'utf8')).replace(/^import .*from ['"]@\/lib\/wholesale['"];?\r?$/m, '');
const previewShuffleUrl = 'data:text/javascript;charset=utf-8,' + encodeURIComponent(previewShuffleCode);
const previewCode = compile(await fs.readFile(path.join(root, 'lib/bannerPreviewImages.ts'), 'utf8')).replace(/from ['"]\.\/shuffleProducts['"]/, 'from ' + JSON.stringify(previewShuffleUrl));
const { selectBannerPreviews } = await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(previewCode));

test('banner previews stay deterministic during a visit and never mutate the real image pool', () => {
  const images = ['a.webp', 'b.webp', 'c.webp', 'a.webp', ''];
  const original = [...images];
  const first = selectBannerPreviews(images, 12, 'category-jewellery');
  assert.deepEqual(selectBannerPreviews(images, 12, 'category-jewellery'), first);
  assert.equal(new Set(first).size, 2);
  assert.ok(first.every(src => images.includes(src) && src));
  assert.deepEqual(images, original);
});

test('a new opening avoids the previous first photo, including a two-image category', () => {
  for (const images of [['a', 'b'], ['a', 'b', 'c', 'd']]) {
    const first = selectBannerPreviews(images, 12, 'sale');
    const next = selectBannerPreviews(images, 12, 'sale', first[0]);
    assert.notEqual(next[0], first[0]);
    assert.equal(new Set(next).size, 2);
  }
});

test('empty or single-photo collections never invent imagery', () => {
  assert.deepEqual(selectBannerPreviews([], 1, 'empty'), []);
  assert.deepEqual(selectBannerPreviews(['only', 'only', ''], 1, 'one', 'only'), ['only']);
});
