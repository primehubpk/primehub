import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';

let code = (await readFile(new URL('../app/api/storefront/read/route.ts', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
code = code.replace(/import[\s\S]*?from ['"][^'"]+['"];\n/g, '');
const mocks = `
const NextResponse = { json: (body, init) => Response.json(body, init) };
const getConfiguredReadMode = () => 'supabase-primary';
const compactPublicCatalogSnapshot = value => value;
const getPublicCatalogSnapshot = async () => ({products:[{id:'catalog'}],categories:[]});
const getPublicCategoriesSnapshot = async () => ({categories:[{id:'category'}]});
const getPublicProductSnapshot = async id => ({product:{id, read:'cached'}});
const getFreshPublicProductSnapshot = async id => ({product:{id, read:'fresh'}});
const getPublicStorefrontSettingsDocumentsSnapshot = async () => ({main:{}});
const getPrimeSkillsSnapshot = async () => ({skills:[]});
const getPublicRewardGiftsSnapshot = async () => [];
const getRewardSettingsSnapshot = async () => ({});
`;
const { GET } = await import(`data:text/javascript;base64,${Buffer.from(mocks + stripTypeScriptTypes(code)).toString('base64')}`);
const read = query => GET(new Request('https://store.example/api/storefront/read?' + query));

test('category directory response excludes the product catalog', async () => {
  const response = await read('type=categories');
  assert.deepEqual(await response.json(), {categories:[{id:'category'}]});
});
test('navigation batches use cached products while purchase reads remain fresh', async () => {
  const batch = await read('type=products&ids=' + encodeURIComponent(JSON.stringify(['p1','p1','p2'])));
  assert.deepEqual((await batch.json()).products, [{id:'p1',read:'cached'},{id:'p2',read:'cached'}]);
  const product = await read('type=product&id=p1');
  assert.equal((await product.json()).product.read, 'fresh');
  assert.match(product.headers.get('cache-control'), /no-store/);
});
test('post-write public refresh bypasses CDN response caching', async () => {
  const response = await read('type=settings&refresh=1');
  assert.match(response.headers.get('cache-control'), /private, no-store/);
});
test('invalid read types and missing product IDs cannot trigger a catalog fetch', async () => {
  assert.equal((await read('type=unknown')).status, 400);
  assert.equal((await read('type=products&ids=invalid')).status, 400);
  assert.equal((await read('type=product')).status, 400);
});
