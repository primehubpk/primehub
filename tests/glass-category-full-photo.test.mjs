import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const shop = fs.readFileSync('components/ShopCatalog.tsx','utf8');
const grid = fs.readFileSync('components/shop/CatalogProductGrid.tsx','utf8');
const card = fs.readFileSync('components/shop/CatalogProductCard.tsx','utf8');

test('glass-bangles category explicitly opts into complete product photography', () => {
  assert.match(shop, /slugifyCategory\(initialCategory \|\| ''\) === 'glass-bangles'/);
  assert.match(shop, /fullPhoto=\{fullPhotoCategory\}/);
  assert.match(shop, /fullPhoto=\{fullPhoto\}/);
  assert.match(grid, /fullPhoto=\{fullPhoto\}/);
});

test('premium glass photo uses full portrait area and contain, with no hover cropping', () => {
  assert.match(card, /data-glass-full-photo=\{fullPhoto \|\| undefined\}/);
  assert.match(card, /fullPhoto \? 'relative aspect-square overflow-hidden bg-\[#FFFCF7\]'/);
  assert.match(card, /fullPhoto \? 'object-contain object-center' : 'object-cover transition duration-500 group-hover:scale-\[1\.03\]'/);
});

test('other categories and price/cart controls preserve existing styles and actions', () => {
  assert.match(shop, /const fullPhotoCategory = slugifyCategory\(initialCategory \|\| ''\) === 'glass-bangles'/);
  assert.match(card, /if \(needsSizeConfirmation\)/);
  assert.match(card, /addProduct\(\{ \.\.\.product, preferredSize: selectedSize \|\| undefined \}\)/);
  assert.match(card, /'relative aspect-\[1\.5\/1\] overflow-hidden bg-\[#F7F2EA\] sm:aspect-\[1\.58\/1\]'/);
  assert.match(card, /'object-cover transition duration-500 group-hover:scale-\[1\.03\]'/);
});