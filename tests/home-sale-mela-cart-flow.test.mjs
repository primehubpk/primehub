import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

test('home Sale Mela keeps bucket boundaries, prioritizes fresh top-row cards, and shuffles the mixed row per refresh', () => {
  const source = read('components/home/HomeCollections.tsx');

  assert.match(source, /function buildHomeTwoRowProducts\(/);
  assert.match(source, /const topRowCount = Math\.ceil\(products\.length \/ 2\)/);
  assert.match(source, /Number\(homePrice\(b\) === amount\) - Number\(homePrice\(a\) === amount\)/);
  assert.match(source, /setHomeShuffleSeed\(railSeed\(\)\)/);
  assert.match(source, /homeShuffleSeed \|\| stableCatalogSeed/);
  assert.match(source, /buildHomeTwoRowProducts\([\s\S]*?baseMatches,[\s\S]*?amount,[\s\S]*?saleShuffleSeed,[\s\S]*?wholesale/);
  assert.match(source, /matchesSaleMelaBucket\(price, amount\)/);
  assert.match(source, /gridTemplateColumns: "none"/);
  assert.match(source, /gridAutoFlow: "column"/);
  assert.match(source, /gridTemplateRows: "repeat\(2, auto\)"/);
  assert.match(source, /gridAutoColumns: "calc\(\(100% - 10px\) \/ 2\)"/);

  assert.match(source, /const \[homeSaleCatalog, setHomeSaleCatalog\] = useState<Product\[\]>/);
  assert.match(source, /homeSaleCatalog\.length > 0/);
  assert.match(source, /setHomeSaleCatalog\(liveCatalog\)/);
});

test('home Add to Cart checks the fresh product before deciding variants or stock', () => {
  const source = read('components/home/HomeCollections.tsx');

  assert.match(source, /async function add\(\)/);
  assert.match(source, /\/api\/storefront\/read\?type=product&id=/);
  assert.match(source, /productHasVariants\(currentProduct\)/);
  assert.match(source, /availableStockOf\(currentProduct\) <= 0/);
  assert.match(source, /productId: currentProduct\.id/);
});

test('variant UI only opens for real saved rows and missing stock safely defaults to 30', () => {
  const shopTypes = read('components/shop/ShopTypes.ts');
  const cartStore = read('lib/cartStore.ts');

  assert.match(shopTypes, /return variantRowsOf\(p\)\.some/);
  assert.doesNotMatch(shopTypes, /p\.hasVariants === true \|\|/);
  assert.match(shopTypes, /rawParentStock == null \|\| rawParentStock === ''[\s\S]*\? 30/);

  assert.match(cartStore, /const hasVariantRows = sourceRows\.length > 0/);
  assert.match(cartStore, /if \(!hasVariantRows\) return \{ hasVariants: false/);
  assert.doesNotMatch(cartStore, /if \(!allSourceRows\.length\) \{/);
  assert.match(cartStore, /row\.stock == null \|\| row\.stock === ''[\s\S]*\? parentStock/);
});

test('bot/admin stock defaults stay at 30 and the active test branch is Vercel-disabled', () => {
  const sync = read('lib/productSync.ts');
  const types = read('components/admin/products/ProductTypes.ts');
  const manager = read('components/admin/products/useProductsManager.ts');
  const vercel = JSON.parse(read('vercel.json'));

  assert.match(sync, /stock: Math\.max\(0, asNumber\(input\.stock, 30\)\)/);
  assert.match(sync, /rawStock == null \|\| rawStock === ''[\s\S]*\? 30/);
  assert.match(types, /stock:'30'/);
  assert.match(manager, /form\.stock \|\| '30'/);
  assert.match(manager, /row\.stock \?\? legacyStock \?\? 30/);
  assert.equal(vercel.git?.deploymentEnabled?.['fix/home-rails-deals-usage-sep29'], false);
  assert.equal(vercel.git?.deploymentEnabled?.['fix/home-sale-mela-layout-shuffle-oct02'], false);
});


test('New Arrivals places View all on the right with a forward arrow', () => {
  const heading = read('components/home/HomeHeading.tsx');
  const css = read('components/home/home.css');

  assert.match(heading, /"New Arrivals":[\s\S]*?label: "View all"[\s\S]*?actionPlacement: "right"[\s\S]*?actionArrow: true/);
  assert.match(heading, /const actionOnRight = destination\.actionPlacement === "right"/);
  assert.match(heading, /destination\.actionArrow \? <span aria-hidden="true">→<\/span>/);
  assert.match(css, /\.home-sale-home\s*\{[\s\S]*?margin-top: 2px;[\s\S]*?padding-top: 0;/);
  assert.match(css, /\.home-sale\.home-sale-home > h2\s*\{[\s\S]*?margin-top: 0;[\s\S]*?margin-bottom: 10px;/);
});


test('homepage reuses the existing standalone Sale Mela where PrimeHubMall Deals used to render', () => {
  const home = read('components/HomePageClient.tsx');

  assert.doesNotMatch(home, /import ProductGridRewards/);
  assert.doesNotMatch(home, /<ProductGridRewards/);
  assert.match(
    home,
    /<HomeCategoryDeals[\s\S]*?<div id="discover-deals-section">[\s\S]*?<HomeCollections[\s\S]*?products=\{products\}[\s\S]*?standalone/,
  );
});
