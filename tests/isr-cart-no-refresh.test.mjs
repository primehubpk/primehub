import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const read = (path) => readFileSync(path, 'utf8');

function verifiedProductModule(fakeFetch) {
  const compiled = ts.transpileModule(read('lib/verifiedDealProduct.ts'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (name) => {
      if (name === '@/lib/cartStore') return {
        normalizeProductVariants: (product) => ({
          hasVariants: Array.isArray(product.variantMatrix) && product.variantMatrix.length > 0,
        }),
      };
      throw new Error('Unexpected dependency: ' + name);
    },
    fetch: fakeFetch,
    Number, String, Array, Boolean, Error,
  });
  return exports;
}

test('fresh no-store product verification keeps real variant rows and distinguishes no-variant items', async () => {
  let requestCount = 0;
  const products = {
    bangles: { id: 'bangles', stock: 30, price: 999, variantMatrix: [{ color: 'Red', size: '2.6', stock: 3 }] },
    watch: { id: 'watch', stock: 30, price: 1200, variantMatrix: [] },
  };
  const module = verifiedProductModule(async (url, init) => {
    requestCount++;
    assert.equal(init.cache, 'no-store');
    const id = new URL(url, 'https://example.test').searchParams.get('id');
    return Response.json({ product: products[id] });
  });
  assert.equal((await module.getVerifiedDealProduct('bangles')).variantMatrix.length, 1);
  assert.equal((await module.getVerifiedDealProduct('watch')).variantMatrix.length, 0);
  assert.equal(requestCount, 2);
});

test('failed product verification never falls back to a compact variant-free catalog card', async () => {
  const module = verifiedProductModule(async () => new Response('unavailable', { status: 503 }));
  await assert.rejects(() => module.getVerifiedDealProduct('bangles'), /Could not verify/);
  const home = read('components/home/HomeCollections.tsx');
  const arrivals = read('components/NewArrivalsRail.tsx');
  assert.match(home, /await getVerifiedDealProduct\(product\.id\)/);
  assert.match(arrivals, /await getVerifiedDealProduct\(product\.id\)/);
  assert.doesNotMatch(home, /using current card data/);
  assert.doesNotMatch(arrivals, /productHasVariants\(product\) &&/);
});

test('home Big Deal, weekly cards, Deals grid and product page do not reload document on Add to Cart', () => {
  const home = read('components/HeroFlashBanner.tsx');
  const grid = read('components/deals/useDeals.ts');
  const deal = read('components/deals/BigDealLanding.tsx');
  const product = read('components/product-detail/useProductDetail.ts');
  for (const source of [home, grid, deal, product]) {
    assert.doesNotMatch(source, /(?:router\.refresh\(|location\.reload\()/);
  }
  assert.match(grid, /await getVerifiedDealProduct\(deal\.productId\)/);
  assert.match(grid, /openVariantModal\(priced,'cart'\)/);
  assert.match(product, /setVariantModalOpen\(true\)/);
  assert.match(home, /Checking options…/);
});

test('global Buy Now after picking real variants uses client-side checkout navigation', () => {
  const source = read('components/GlobalVariantSelector.tsx');
  assert.match(source, /router\.push\('\/checkout'\)/);
  assert.doesNotMatch(source, /window\.location\.href\s*=\s*'\/checkout'/);
  assert.match(source, /normalizeProductVariants\(product\)/);
});

test('homepage ISR fallback is six hours while admin invalidation stays intact', () => {
  assert.match(read('app/page.tsx'), /export const revalidate = 21600/);
  assert.match(read('app/api/admin/big-deal/route.ts'), /revalidateTag\('storefront-settings'/);
  assert.match(read('lib/publicCatalogServer.ts'), /tags: \['public-catalog'\]/);
  const config = JSON.parse(read('vercel.json'));
  assert.equal(config.git.deploymentEnabled, false);
});
