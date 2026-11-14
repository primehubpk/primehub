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
  assert.ok(sale.includes('const saleShuffleSeed = stableSaleMelaSeed(catalog)'));
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
  assert.ok(home.indexOf('<HomeCategoryDealsLazy') < home.indexOf('<SkillsShowcase'));
  assert.ok(home.indexOf('<SkillsShowcase') < home.indexOf('<HomeCollections'));
  assert.ok(home.indexOf('<HomePrimeFamilyLazy') < home.indexOf('<HomeCollections'));
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

test('home Sale Mela uses a full vertical grid while upper category trails stay horizontally swipeable', async () => {
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
  assert.ok(sale.includes('verticalHome ? visitProducts.slice(0, limit) : visitProducts'));
  assert.ok(sale.includes('gridTemplateRows: \"repeat(1, auto)\"'));
  assert.ok(sale.includes('enabled: !standalone && !verticalHome'));
  assert.ok(sale.includes("verticalHome ? { display: 'grid'"));
  assert.ok(sale.includes('{(standalone || verticalHome) && limit < products.length'));
  assert.match(css, /\.home-sale-home--vertical \.home-sale-products--vertical/);
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

test('homepage positions full Prime Family before the final vertical Sale Mela', async () => {
  const home = await fs.readFile(path.join(root, 'components/HomePageClient.tsx'), 'utf8');
  const order = ['<HomeCategoryDealsLazy', '<SkillsShowcase', '<HomePrimeFamilyLazy', '<HomeCollections'];
  const indices = order.map(needle => home.indexOf(needle));
  assert.ok(indices.every(i => i >= 0), 'all four homepage sections are present');
  assert.deepEqual(indices, [...indices].sort((a, b) => a - b));
  assert.equal([...home.matchAll(/<HomeCollections\b/g)].length, 1);
  assert.doesNotMatch(home, /<HomeDiscoverDealsLazy\b/);
  assert.match(home, /catalogUnavailable \? \(/);
  assert.match(home, /<HomePrimeFamilyLazy initialSettings=/);
});

test('Prime Family displays the real dashboard without a redundant top banner or loading card', async () => {
  const [family, css, dashboard, categories] = await Promise.all([
    'components/home/HomePrimeFamilyLazy.tsx',
    'components/home/HomeCommerceRails.css',
    'components/reseller/PrimeFamilyDashboard.tsx',
    'components/home/HomeCategoryDealsLazy.tsx',
  ].map(name => fs.readFile(path.join(root, name), 'utf8')));
  assert.doesNotMatch(family, /HomePrimeFamilyBanner|home-commerce-banner--family/);
  assert.match(family, /import PrimeFamilyDashboard from '@\/components\/reseller\/PrimeFamilyDashboard'/);
  assert.doesNotMatch(family, /PrimeFamilyPreview|PrimeFamilyLoading|next\/dynamic|IntersectionObserver/);
  assert.match(family, /<PrimeFamilyDashboard embedded initialSettings=\{initialSettings\} \/>/);
  assert.match(dashboard, /if \(loading && !embedded\)/);
  assert.doesNotMatch(css, /\.home-prime-family-banner/);
  assert.match(dashboard, /<RewardWheel settings=\{wheel\}/);
  assert.match(dashboard, /<PremiumSpinWheel prizes=\{prizes\}/);
  assert.match(categories, /<HomeCategoryDeals products=\{products\} categories=\{categories\} \/>/);
});

test('homepage has unique shopping blocks and one reachable Prime Family dashboard', async () => {
  const home = await fs.readFile(path.join(root, 'components/HomePageClient.tsx'), 'utf8');
  const once = [
    '<CategorySwiper', '<HomeGlassOfferRail', '<BogoDeals', '<NewArrivalsRail',
    '<HomePrimeSkills', '<HomeWholesaleVideos', '<HomeCategoryDealsLazy',
    '<SkillsShowcase', '<HomeCollections', '<HomePrimeFamilyLazy',
  ];
  for (const tag of once) {
    assert.equal(home.split(tag).length - 1, 1, `Only one ${tag} should be mounted on home`);
  }
  assert.doesNotMatch(home, /<HomeDiscoverDealsLazy/);
  assert.doesNotMatch(home, /<HomePrimeFamilyBanner/);
  assert.match(home, /id="prime-family-dashboard"/);
  assert.equal(home.split('<HomePrimeFamilyLazy').length - 1, 1);
  assert.equal(home.split('id="home-prime-family"').length - 1, 1);
  assert.ok(home.indexOf('id="home-prime-family"') < home.indexOf('<HomeCollections'));
  assert.ok(home.indexOf('id="home-prime-family"') < home.indexOf('<HomePrimeFamilyLazy'));
  assert.ok(home.indexOf('<HomePrimeFamilyLazy') < home.indexOf('<HomeCollections'));
  assert.ok(home.indexOf('<HomeCollections') < home.indexOf('</main>'));
  // Featured services near arrivals and the full services showcase lower on the
  // page serve different navigation purposes; they must not each mount twice.
  assert.ok(home.indexOf('<HomePrimeSkills') < home.indexOf('<HomeCategoryDealsLazy'));
  assert.ok(home.indexOf('<HomeCategoryDealsLazy') < home.indexOf('<SkillsShowcase'));
});

test('homepage connects the full Prime Family before an unbounded vertical Sale Mela', async () => {
  const [home, sale, css, commerce] = await Promise.all([
    'components/HomePageClient.tsx', 'components/home/HomeCollections.tsx',
    'components/home/home.css', 'components/home/HomeCommerceRails.tsx',
  ].map(f => fs.readFile(path.join(root, f), 'utf8')));
  assert.ok(home.indexOf('<HomePrimeFamilyLazy') < home.indexOf('<HomeCollections'));
  assert.match(home, /<HomeCollections[\s\S]*?verticalHome/);
  assert.equal((home.match(/<HomeCollections\b/g) || []).length, 1);
  assert.match(sale, /verticalHome \? visitProducts\.slice\(0, limit\)/);
  assert.match(sale, /\(standalone \|\| verticalHome\) && limit < products\.length/);
  assert.match(sale, /enabled: !standalone && !verticalHome/);
  assert.match(sale, /showArrows=\{!verticalHome\}/);
  assert.match(sale, /standalone \|\| verticalHome \? visibleProducts\.map/);
  assert.match(css, /\.home-sale-home--vertical \.home-sale-products--vertical/);
  assert.match(css, /grid-auto-flow:row/);
  assert.match(css, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(commerce, /onPrevious=\{showArrows \?/);
});

test('each fresh homepage entry shuffles the newest items but retains all IDs', async () => {
  const { recentProductsForVisit } = await import(previewShuffleUrl);
  const items = Array.from({ length: 96 }, (_, i) => ({
    id: 'item-' + i,
    createdAt: new Date(Date.UTC(2026, 10, 14) - i * 60000).toISOString(),
  }));
  const first = recentProductsForVisit(items, 1201, 'new-arrivals-home');
  const second = recentProductsForVisit(items, 1202, 'new-arrivals-home', first[0].id);
  assert.equal(first.length, 96);
  assert.equal(second.length, 96);
  assert.equal(new Set(second.map(x => x.id)).size, 96);
  assert.notEqual(first[0].id, second[0].id);
  const topIds = new Set(items.slice(0, 24).map(x => x.id));
  assert.ok(second.slice(0, 24).every(x => topIds.has(x.id)));
  assert.deepEqual(second, recentProductsForVisit(items, 1202, 'new-arrivals-home', first[0].id));
  const hook = await fs.readFile(path.join(root, 'lib/useVisitProductOrder.ts'), 'utf8');
  assert.match(hook, /useLayoutEffect\(\(\) => \{\s*const active = enabled && pathname === '\/'/);
  assert.match(hook, /setVisit\(\{ seed, previous \}\)/);
  assert.match(hook, /localStorage\.setItem\(storageKey, firstId\)/);
});

test('three final Sale Mela retail price ranges are complete, disjoint and have no maximum cap', async () => {
  const source = await fs.readFile(path.join(root, 'lib/priceBucketUtils.ts'), 'utf8');
  const { matchesSaleMelaBucket, saleMelaPriceRange } = await import(
    'data:text/javascript;charset=utf-8,' + encodeURIComponent(compile(source))
  );
  const amounts = [99, 299, 999];
  const checks = [
    [1, 99], [10, 99], [98, 99], [99, 99], [298, 99],
    [299, 299], [300, 299], [998, 299],
    [999, 999], [1000, 999], [2499, 999], [19999, 999], [999999, 999],
  ];
  for (const [price, expected] of checks) {
    const actual = amounts.filter(amount => matchesSaleMelaBucket(price, amount));
    assert.deepEqual(actual, [expected], 'price ' + price + ' should appear in exactly one bucket');
  }
  assert.deepEqual(amounts.filter(amount => matchesSaleMelaBucket(0, amount)), []);
  assert.deepEqual(saleMelaPriceRange(99), { minInclusive: 1, maxExclusive: 299 });
  assert.deepEqual(saleMelaPriceRange(299), { minInclusive: 299, maxExclusive: 999 });
  assert.deepEqual(saleMelaPriceRange(999), { minInclusive: 999, maxExclusive: null });

  const sale = await fs.readFile(path.join(root, 'components/home/HomeCollections.tsx'), 'utf8');
  assert.match(sale, /\[99, 299, 999\] as const/);
  assert.match(sale, /packs\.length > 0 \?/);
  assert.match(sale, /const buckets = verticalHome/);
  assert.doesNotMatch(sale, /if \(verticalHome && wholesale\) return null/);
  assert.doesNotMatch(sale, /const \[homeSaleCatalog,/);
  assert.match(sale, /const matches = verticalHome[\s\S]*?\? baseMatches/);
  assert.match(sale, /matchesSaleMelaBucket\(price, amount\)/);
  assert.match(sale, /\(standalone \|\| verticalHome\) && limit < products.length/);
});

test('local 393px Chrome actually renders Family and all Sale Mela tiers when preview is running', {timeout: 135000}, async t => {
  if (process.platform !== 'win32') return t.skip('Local Windows-only visual audit');
  let up;
  try { up = await fetch('http://127.0.0.1:3000/', { signal: AbortSignal.timeout(6500) }); }
  catch { return t.skip('The local preview is not running'); }
  if (!up.ok) return t.skip('The local preview is not serving HTTP 200');
  const { spawnSync } = await import('node:child_process');
  const script = "from playwright.sync_api import sync_playwright\nimport json\nwith sync_playwright() as p:\n    b=p.chromium.launch(channel=\"chrome\",headless=True,args=[\"--disable-extensions\",\"--no-first-run\"])\n    c=b.new_context(viewport={\"width\":393,\"height\":852},is_mobile=True,has_touch=True)\n    pg=c.new_page()\n    errors=[]\n    pg.on(\"pageerror\",lambda e:errors.append(str(e)[:150]))\n    r=pg.goto(\"http://127.0.0.1:3000/?preview=family-sale-audit\",wait_until=\"domcontentloaded\",timeout=85000)\n    pg.wait_for_selector(\".home-sale-home--vertical\",timeout=30000)\n    pg.locator(\"#home-prime-family\").scroll_into_view_if_needed(timeout=15000)\n    try:\n        pg.wait_for_selector(\"#club-home\",timeout=32000)\n        family=True\n    except Exception:\n        family=False\n    data=pg.evaluate(\"\"\"() => {\n      const frames=[...document.querySelectorAll('.home-sale-home--vertical .home-sale-home-frame')];\n      return {\n        width:innerWidth,scrollWidth:document.documentElement.scrollWidth,\n        banner:document.querySelectorAll('.home-prime-family-banner').length,\n        familyDashboard:!!document.getElementById('club-home'),\n        familyText:document.querySelector('.home-prime-family-lazy')?.textContent?.slice(0,350) || '',\n        loadingCard:document.body.textContent.includes('Prime Family rewards load ho rahe hain'),\n        ranges:frames.map((f)=>({\n          heading:f.querySelector('.home-commerce-banner__copy h2')?.textContent?.trim() || '',\n          cards:f.querySelectorAll('.home-product').length,\n          hasNext:!!f.querySelector('.home-sale-products--vertical > div[aria-hidden=\"true\"]')\n        }))\n      };\n    }\"\"\")\n    data.update({\"http\":r.status if r else 0,\"family\":family,\"errors\":errors[:4]})\n    rows=pg.locator('.home-sale-home--vertical .home-sale-home-frame')\n    for i in range(rows.count()):\n        frame=rows.nth(i)\n        count=frame.locator('.home-product').count()\n        sentinel=frame.locator('.home-sale-products--vertical > div[aria-hidden=\"true\"]')\n        if sentinel.count():\n            sentinel.scroll_into_view_if_needed(timeout=16000)\n            pg.wait_for_timeout(1400)\n            data['progression']={'initial':count,'after':frame.locator('.home-product').count()}\n            break\n    pg.wait_for_function(\"\"\"() => {const frames=[...document.querySelectorAll('.home-sale-home--vertical .home-sale-home-frame')];return frames.length===4 && frames.every(f=>!!f.querySelector('.home-sale-progress--complete'))}\"\"\",timeout=85000)\n    data['finalCounts']=pg.evaluate(\"\"\"() => [...document.querySelectorAll('.home-sale-home--vertical .home-sale-home-frame')].map(f=>f.querySelectorAll('.home-product').length)\"\"\")\n    print(json.dumps(data,ensure_ascii=True),flush=True)\n    c.close();b.close()\n";
  const result = spawnSync('python', ['-c', script], {
    cwd:root,encoding:'utf8',shell:false,windowsHide:true,timeout:114000,maxBuffer:50000,
  });
  assert.equal(result.status,0, String(result.stderr||result.error?.message||result.stdout||'').slice(-1400));
  const last=String(result.stdout||'').trim().split(/\\r?\\n/).at(-1);
  const report=JSON.parse(last);
  console.log('LOCAL_MOBILE_AUDIT '+JSON.stringify(report));
  assert.equal(report.http,200);
  assert.equal(report.banner,0);
  assert.equal(report.familyDashboard,true,'actual Prime Family dashboard must render, not loading fallback');
  assert.equal(report.loadingCard,false);
  assert.equal(report.ranges.length,4,'Three retail bands and separate wholesale');
  assert.match(report.ranges[0].heading,/1.?298/);
  assert.match(report.ranges[1].heading,/299.?998/);
  assert.match(report.ranges[2].heading,/999/);
  assert.match(report.ranges[3].heading,/Wholesale/i);
  assert.ok(report.ranges.every(x=>x.cards>0),'Every populated band must show real product cards');
  assert.equal(report.scrollWidth,report.width,'No horizontal overflow on mobile');
  if(report.progression)assert.ok(report.progression.after>report.progression.initial,'Scroll should load more products');
  assert.equal(report.finalCounts?.length,4,'All four sections must finish loading');
  assert.ok(report.finalCounts.every(n=>n>0),'Every final collection must finish with real products');
});

test('mobile Chrome reload audit compares real product IDs over three fresh visits', {timeout: 145000}, async t => {
  if (process.platform !== 'win32') return t.skip('Windows-local browser only');
  let response;
  try { response=await fetch('http://127.0.0.1:3000/',{signal:AbortSignal.timeout(6500)}); }
  catch { return t.skip('Local preview unavailable'); }
  if (!response.ok) return t.skip('Preview returned non-200');
  const {spawnSync}=await import('node:child_process');
  const script="from playwright.sync_api import sync_playwright\nimport json\nwith sync_playwright() as p:\n  browser=p.chromium.launch(channel=\"chrome\",headless=True,args=[\"--disable-extensions\",\"--no-first-run\"])\n  context=browser.new_context(viewport={\"width\":393,\"height\":852},is_mobile=True,has_touch=True)\n  page=context.new_page()\n  errors=[]\n  page.on(\"pageerror\",lambda e:errors.append(str(e)[:240]))\n  results=[]\n  for visit in range(3):\n    if visit==0:\n      response=page.goto(\"http://127.0.0.1:3000/?preview=reload-shuffle\",wait_until=\"domcontentloaded\",timeout=70000)\n    else:\n      response=page.reload(wait_until=\"domcontentloaded\",timeout=70000)\n    page.wait_for_selector(\".home-arrivals__rail[aria-busy='false']\",timeout=38000)\n    page.wait_for_selector(\".bogo-rail[aria-busy='false']\",timeout=38000)\n    page.wait_for_selector(\".glass-offers-home__viewport[aria-busy='false']\",timeout=38000)\n    page.wait_for_timeout(750)\n    row=page.evaluate(\"\"\"()=> {\n      const read=(selector,attribute,n=6)=>Array.from(document.querySelectorAll(selector)).slice(0,n).map(x=>attribute==='href'?x.getAttribute('href'):x.getAttribute(attribute));\n      const sale=Array.from(document.querySelectorAll('.home-sale-products--vertical')).slice(0,4).map(x=>Array.from(x.querySelectorAll('a[href^=\"/product/\"]')).slice(0,4).map(y=>y.getAttribute('href')));\n      return {\n        mega:read('.glass-offers-home__group[data-loop-original] article[data-product-id]','data-product-id',8),\n        bogo:read('.bogo-rail__group[data-loop-original] article[data-bogo-id]','data-bogo-id',8),\n        arrivals:read('.home-arrivals__rail > div a[href^=\"/product/\"]','href',8),\n        sale:sale,\n        category:read('[data-home-category-rail] > div a[href^=\"/product/\"]','href',8),\n        headers:read('.home-arrivals .collection-banner-photo','data-banner-product',2),\n        ready:{\n          mega:document.querySelector('.glass-offers-home__viewport')?.getAttribute('aria-busy'),\n          bogo:document.querySelector('.bogo-rail')?.getAttribute('aria-busy'),\n          arrivals:document.querySelector('.home-arrivals__rail')?.getAttribute('aria-busy'),\n        },\n        familyBannerCount:document.querySelectorAll('.home-prime-family-banner').length,\n      };\n    }\"\"\")\n    row[\"visit\"]=visit\n    row[\"http\"]=response.status if response else 0\n    results.append(row)\n  print(json.dumps({\"visits\":results,\"errors\":errors[:6]},ensure_ascii=True),flush=True)\n  context.close()\n  browser.close()\n";
  const out=spawnSync('python',['-c',script],{cwd:root,encoding:'utf8',windowsHide:true,shell:false,timeout:130000,maxBuffer:52000});
  assert.equal(out.status,0,String(out.stderr||out.error?.message||out.stdout||'').slice(-1800));
  const report=JSON.parse(String(out.stdout||'').trim().split(/\\r?\\n/).at(-1));
  console.log('RELOAD_PRODUCT_AUDIT '+JSON.stringify(report));
  assert.equal(report.visits.length,3);
  assert.ok(report.visits.every(x=>x.http===200 && x.ready.arrivals==='false' && x.ready.bogo==='false' && x.ready.mega==='false'));
  assert.ok(report.visits.every(x=>x.familyBannerCount===0));
  assert.ok(report.visits.every(v=>v.arrivals.length>1),'New Arrivals must expose multiple real cards in browser');
  for(const key of ['mega','bogo','arrivals','category']){
    const items=report.visits.map(v=>v[key]);
    if(items.every(list=>list.length>1)){
      assert.notEqual(items[0][0],items[1][0],key+' first product must change on refresh 1');
      assert.notEqual(items[1][0],items[2][0],key+' first product must change on refresh 2');
    }
  }
  const sale=report.visits.map(v=>v.sale?.[0] || []);
  if(sale.every(list=>list.length>1)){
    assert.notEqual(sale[0][0],sale[1][0],'Sale Mela first recent item must change on refresh');
    assert.notEqual(sale[1][0],sale[2][0],'Sale Mela shuffle must change every refresh');
  }
});
