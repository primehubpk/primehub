import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeImageUrl, isDirectStorefrontImage } from '../lib/imageUrl.ts';
const mirror='https://pub-157b90419bf04016bdea666e4cbce181.r2.dev';
test('owned branded CDN falls back to the same object on the verified HTTPS bucket',()=>{assert.equal(normalizeImageUrl('https://images.primehubmall.com/products/a.webp?x=1'),mirror+'/products/a.webp?x=1');assert.equal(normalizeImageUrl(mirror+'/products/a.webp'),mirror+'/products/a.webp');assert.equal(isDirectStorefrontImage(mirror+'/products/a.webp'),true);});
test('display mapping does not rewrite unrelated or lookalike hosts',()=>{for(const url of ['https://i.ibb.co/a.jpg','/bogo/gift-icon.webp','https://images.primehubmall.com.evil/a.webp','https://other.test/image.webp'])assert.equal(normalizeImageUrl(url),url);assert.equal(normalizeImageUrl(''), '');});
