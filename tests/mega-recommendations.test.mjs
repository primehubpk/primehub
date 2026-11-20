import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const code = ts.transpileModule(fs.readFileSync('lib/megaRecommendations.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { selectMegaRecommendations } = await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(code));

test('Mega recommendations stay within configured offers and prefer the current category', () => {
  const current = { id: 'box', category: 'Glass Bangles' };
  const offers = [
    { product: current, price: 1209 },
    { product: { id: 'matching', category: 'glass bangles' }, price: 999 },
    { product: { id: 'bag', category: 'Bags' }, price: 2000 },
    { product: { id: 'hidden', category: 'Glass Bangles', published: false }, price: 999 },
    { product: { id: 'inactive', category: 'Glass Bangles', active: false }, price: 999 },
  ];
  const before = structuredClone(offers);
  assert.deepEqual(selectMegaRecommendations(current, offers).map(x => x.product.id), ['matching']);
  assert.deepEqual(offers, before);
});

test('a category with no other Mega offers uses the remaining active Mega collection', () => {
  const offers = [
    { product: { id: 'bag', category: 'Bags' }, price: 100 },
    { product: { id: 'watch', category: 'Watches' }, price: 150 },
  ];
  assert.deepEqual(selectMegaRecommendations({ id: 'bag', category: 'Bags' }, offers).map(x => x.product.id), ['watch']);
  assert.deepEqual(selectMegaRecommendations({ id: 'bag', category: '' }, offers).map(x => x.product.id), ['watch']);
});

test('disabled or empty offer collections never invent substitute products', () => {
  assert.deepEqual(selectMegaRecommendations({ id: 'box' }, []), []);
  assert.deepEqual(selectMegaRecommendations({ id: 'only' }, [{ product: { id: 'only' }, price: 100 }]), []);
});
