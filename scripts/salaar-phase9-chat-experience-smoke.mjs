import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function text(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

async function loadDealPricing() {
  const source = await text('lib/dealPricing.ts');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`);
}

const { getEffectivePrice, getPakistanDay } = await loadDealPricing();
const monday = new Date('2026-09-07T12:00:00+05:00');
const tuesday = new Date('2026-09-08T12:00:00+05:00');
assert.equal(getPakistanDay(monday), 'Monday');
assert.equal(getEffectivePrice({ price: 1000, dealPrice: 700, dealDay: 'Monday' }, monday), 700);
assert.equal(getEffectivePrice({ price: 1000, dealPrice: 700, dealDay: 'Monday' }, tuesday), 1000);
assert.equal(getEffectivePrice({ price: 1000, dealPrice: 1200, dealDay: 'Monday' }, monday), 1000);

const widget = await text('components/SalaarNative.tsx');
assert.ok(widget.includes('Maximize2'));
assert.ok(widget.includes('Minimize2'));
assert.ok(widget.includes('<Minus'));
assert.ok(widget.includes('setExpanded'));
assert.ok(widget.includes('Ask about this'));
assert.ok(widget.includes('referencedProductId'));
assert.ok(widget.includes('history.pushState'));
assert.ok(widget.includes("window.addEventListener('popstate'"));
assert.ok(widget.includes('role="dialog"'));
assert.equal(/Add to cart|Add to Cart|ADD TO CART/.test(widget), false);

const dealCore = await text('lib/salaarDealPricing.ts');
assert.ok(dealCore.includes("from '@/lib/dealPricing'"));
assert.ok(dealCore.includes('getEffectivePrice'));
assert.ok(dealCore.includes('getPakistanDay'));
assert.ok(dealCore.includes('knowledge?.weeklyDeals'));
assert.ok(dealCore.includes('knowledge?.bigDeal'));

const catalogCache = await text('lib/salaarCatalogCache.ts');
assert.ok(catalogCache.includes('normalPrice: product?.normalPrice'));
assert.ok(catalogCache.includes('dealPrice: product?.dealPrice'));
assert.ok(catalogCache.includes('dealDay: serialText(product?.dealDay'));
assert.ok(catalogCache.includes('withSalaarEffectivePricing(product, knowledge)'));
assert.ok(catalogCache.includes("tags: ['salaar-catalog', 'salaar-store-knowledge']"));

const live = await text('app/api/salaar/live/route.ts');
assert.ok(live.includes('referencedProductId'));
assert.ok(live.includes('pendingReferencedProductId'));
assert.ok(live.includes('pendingReferencedProductId: null'));

const chat = await text('app/api/salaar/chat/route.ts');
assert.ok(chat.includes('requestedReferenceId'));
assert.ok(chat.includes('findReferenceProduct'));
assert.ok(chat.includes('referencedProduct: compactReferencedProduct'));
assert.ok(chat.includes('client-supplied') === false);
assert.ok(chat.includes('salaarDealLive'));
assert.ok(chat.includes('live deal'));
assert.equal(chat.includes('Pasand aye to yahin cart mein add kar dein.'), false);

const memory = await text('lib/salaarSalesMemoryCore.ts');
assert.ok(memory.includes('iska|iski|iske'));
assert.ok(memory.includes('is ka|is ki|is ke'));

const adminLogin = await text('app/api/admin/login/route.ts');
assert.ok(adminLogin.includes('process.env.ADMIN_PASSWORD'));
assert.equal(adminLogin.includes('NEXT_PUBLIC_ADMIN_PASSWORD'), false);
assert.equal(adminLogin.includes("|| 'junaid00'"), false);

const vercel = await text('vercel.json');
assert.ok(vercel.includes('"feature/salaar-virtual-salesman"'));

console.log('Salaar Phase 9 chat experience smoke: PASS');
