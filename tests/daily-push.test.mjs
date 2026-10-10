// node --test tests/daily-push.test.mjs (after npm ci)
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../lib/notifications/dailyPush.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports = {};
const module = { exports };
const fakeBigDealModule = {
  bigDealConfiguredSlotCount: () => 1,
  bigDealRotationIndex: () => 0,
};
vm.runInNewContext('(function(require,module,exports){' + compiled + '\n})',
  { URL, Date, Intl, console })(
    name => {
      if (name !== '@/lib/bigDealRotation') throw new Error('Unexpected import ' + name);
      return fakeBigDealModule;
    },
    module, exports);
const { selectDailyPush, pakistanDay } = module.exports;
const now = new Date('2026-10-09T06:00:00Z'); // 11 AM Pakistan
const product = { id: 'p1', title: 'Real Bangles', price: 399, stock: 3, createdAt: '2026-10-08T00:00:00Z', imageUrl: 'https://images.primehubmall.com/p1.webp' };
const settings = {
  dailyDeal: { active: true, productId: 'p1', dealPrice: 299, originalPrice: 500, imageUrl: product.imageUrl },
  weeklyDeals: [{ active: true, day: 'friday', productId: 'p1', dealPrice: 299, originalPrice: 500 }],
};
test('Pakistan local date is consistent with daily idempotency', () => {
  assert.equal(pakistanDay(new Date('2026-10-09T20:30:00Z')), '2026-10-10');
});
test('skip browse when app was never opened or order placed', () => {
  assert.equal(selectDailyPush('browse', now, 'dev1', {}, [product], settings), null);
  assert.equal(selectDailyPush('browse', now, 'dev1',
    { lastOpenedAt: '2026-10-09T05:00:00Z', lastOrderAt: '2026-10-09T05:20:00Z' }, [product], settings), null);
});
test('browse chooses the genuinely viewed product, with real low-stock only', () => {
  const item = selectDailyPush('browse', now, 'dev1',
    { lastOpenedAt: '2026-10-09T05:00:00Z', lastProductId: 'p1' }, [product], settings);
  assert.ok(item);
  assert.equal(item.path, '/product/p1');
  assert.ok(item.body.includes('Real Bangles') || item.body.includes('399'));
});
test('valid Big Deal has a real image and direct deep link', () => {
  const item = selectDailyPush('big', now, 'dev1', {}, [product], settings);
  assert.equal(item?.imageUrl, product.imageUrl);
  assert.equal(item?.path, '/deals/big');
  assert.equal(selectDailyPush('big', now, 'dev1', {}, [product], { dailyDeal: { ...settings.dailyDeal, active: false } }), null);
});
test('live deal only for today and valid stock', () => {
  assert.equal(selectDailyPush('live', now, 'dev1', {}, [product], settings)?.path, '/weekly-deals');
  assert.equal(selectDailyPush('live', now, 'dev1', {}, [{ ...product, stock: 0 }], settings), null);
});
test('new arrivals skip old products; copy rotates across local dates', () => {
  assert.equal(selectDailyPush('arrivals', now, 'dev1', {}, [product], settings)?.path, '/new-arrivals');
  assert.equal(selectDailyPush('arrivals', now, 'dev1', {}, [{ ...product, createdAt: '2026-09-01T00:00:00Z' }], settings), null);
  const d1 = selectDailyPush('big', now, 'dev1', {}, [product], settings);
  const d2 = selectDailyPush('big', new Date('2026-10-10T06:00:00Z'), 'dev1', {}, [product], settings);
  assert.notEqual(d1?.title, d2?.title);
});
