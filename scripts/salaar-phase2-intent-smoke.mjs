import assert from 'node:assert/strict';
import {
  effectiveProductQuery,
  intentNeedsLlm,
  parseSalesIntent,
  rankProductsForIntent,
} from '../lib/salaarSalesIntent.ts';

const catalog = {
  categories: [
    { id: 'glass', name: 'Glass Bangles', slug: 'glass-bangles' },
    { id: 'jewellery', name: 'Jewellery Collection', slug: 'jewellery' },
  ],
  products: [
    { id: 'g99', title: 'Red Glass Bangles', category: 'Glass Bangles', color: 'Red', material: 'Glass', price: 99, active: true },
    { id: 'g450', title: 'Green Glass Bangles', category: 'Glass Bangles', color: 'Green', material: 'Glass', price: 450, active: true },
    { id: 'g1200', title: 'Red Premium Glass Bangles', category: 'Glass Bangles', color: 'Red', material: 'Glass', price: 1200, active: true },
    { id: 'j750', title: 'Gold Jewellery Set', category: 'Jewellery Collection', color: 'Gold', material: 'Metal', price: 750, active: true },
    { id: 'j1800', title: 'Premium Jewellery Set', category: 'Jewellery Collection', color: 'Gold', material: 'Metal', price: 1800, active: true },
  ],
};

function ids(products) {
  return products.map((product) => product.id);
}

{
  const intent = parseSalesIntent('mujhe 99 wali products dikhao', catalog);
  assert.equal(intent.kind, 'product_search');
  assert.equal(intent.filters.maxPrice, 99);
  assert.deepEqual(ids(rankProductsForIntent(catalog.products, intent, [])), ['g99']);
}

{
  const intent = parseSalesIntent('500 se 1000 tak jewellery dikhao', catalog);
  assert.equal(intent.filters.minPrice, 500);
  assert.equal(intent.filters.maxPrice, 1000);
  assert.equal(intent.filters.category, 'Jewellery Collection');
  assert.deepEqual(ids(rankProductsForIntent(catalog.products, intent, [])), ['j750']);
}

{
  const intent = parseSalesIntent('red glass bangles 1500 tak dikhao', catalog);
  assert.equal(intent.filters.category, 'Glass Bangles');
  assert.equal(intent.filters.color, 'Red');
  assert.equal(intent.filters.maxPrice, 1500);
  assert.deepEqual(ids(rankProductsForIntent(catalog.products, intent, [])), ['g99', 'g1200']);
}

{
  const history = [{ role: 'customer', text: 'glass bangles dikhao' }];
  assert.equal(effectiveProductQuery('aur dikhao', history, catalog), 'glass bangles dikhao');
}

{
  const intent = parseSalesIntent('6 pair glass bangles chahiye', catalog);
  assert.equal(intent.filters.quantity, 6);
  assert.equal(intent.filters.category, 'Glass Bangles');
}

{
  const intent = parseSalesIntent('Big Deal kya hai?', catalog);
  assert.equal(intent.kind, 'deal');
  assert.equal(intentNeedsLlm(intent), true);
}

{
  const intent = parseSalesIntent('Lahore delivery kitne din mein hoti hai?', catalog);
  assert.equal(intent.kind, 'delivery');
  assert.equal(intentNeedsLlm(intent), false);
}

{
  const intent = parseSalesIntent('which one is better?', catalog);
  assert.equal(intent.kind, 'comparison');
  assert.equal(intentNeedsLlm(intent), true);
}

{
  const intent = parseSalesIntent('emerald titanium product dikhao', catalog);
  assert.deepEqual(rankProductsForIntent(catalog.products, intent, []), []);
}

console.log('Salaar Phase 2 intent smoke: PASS');
