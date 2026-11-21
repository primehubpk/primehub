import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const shop=fs.readFileSync('components/ShopCatalog.tsx','utf8');
const grid=fs.readFileSync('components/shop/CatalogProductGrid.tsx','utf8');
const card=fs.readFileSync('components/shop/CatalogProductCard.tsx','utf8');
test('glass category keeps its existing catalog route and full-photo metadata',()=>{
 assert.match(shop,/fullPhoto=\{fullPhotoCategory\}/);
 assert.match(grid,/fullPhoto=\{fullPhoto\}/);
 assert.match(card,/data-glass-full-photo=\{fullPhoto \|\| undefined\}/);
});
test('every category uses complete photography and keeps real size and cart actions',()=>{
 assert.doesNotMatch(card,/object-cover|group-hover:scale/);
 assert.match(card,/aspect-\[4\/5\]/);
 assert.match(card,/object-contain object-center p-1/);
 assert.match(card,/if \(needsSizeConfirmation\)/);
 assert.match(card,/addProduct\(\{ \.\.\.product, preferredSize: selectedSize \|\| undefined \}\)/);
});
