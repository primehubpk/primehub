import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

test('home Sale Mela keeps exact bucket-price cards first and freezes the first populated catalog', () => {
  const source = read('components/home/HomeCollections.tsx');

  assert.match(source, /function orderHomeSaleMelaProducts\(/);
  assert.match(source, /homePrice\(product\) === amount/);
  assert.match(source, /const featured = exactPrice\.slice\(0, 2\)/);
  assert.match(source, /const randomPool = exactPrice\.slice\(2\)/);
  assert.match(source, /homePrice\(product\) > amount/);
  assert.match(source, /priceDifference = homePrice\(a\) - homePrice\(b\)/);

  assert.match(source, /const \[homeSaleCatalog, setHomeSaleCatalog\] = useState<Product\[\]>/);
  assert.match(source, /homeSaleCatalog\.length > 0/);
  assert.match(source, /setHomeSaleCatalog\(liveCatalog\)/);
  assert.match(source, /: orderHomeSaleMelaProducts\(baseMatches, amount, shuffleSeed\)/);
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
  assert.equal(
    vercel.git?.deploymentEnabled?.['fix/category-continuous-sections'],
    false,
  );
});
