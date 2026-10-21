import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function loadPureExports(path) {
  const source = readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}
  }).outputText;
  const module = {exports: {}};
  vm.runInNewContext(js, {
    module, exports: module.exports,
    require: () => ({}), console, Intl, Date, Number, String, Set,
  }, {filename: path, timeout: 2000});
  return module.exports;
}
const {cleanVoucher, resolveCheckoutVoucher} = loadPureExports('lib/checkoutVouchersServer.ts');
const {cashBackForTier, orderEligibleSubtotal} = loadPureExports('lib/orderBenefits.ts');
const promo = {id:'promo-1',code:'PRIMEFAMILY',kind:'cashback',amount:0,percent:10,active:true};
test('admin percentage validated; legacy fixed vouchers unchanged', () => {
  assert.equal(cleanVoucher(promo)?.percent, 10);
  assert.equal(cleanVoucher({...promo,percent:0}), null);
  assert.equal(cleanVoucher({...promo,percent:101}), null);
  assert.equal(cleanVoucher({...promo,percent:1.5}), null);
  assert.equal(cleanVoucher({...promo,amount:500}), null);
  assert.equal(cleanVoucher({...promo,kind:'cash',amount:250}).amount, 250);
  assert.equal(cleanVoucher({...promo,kind:'discount',amount:150}).amount, 150);
});
test('promo code converts 10% of authoritative eligible subtotal into cash award', () => {
  const found=resolveCheckoutVoucher([cleanVoucher(promo)],'primefamily',1000);
  assert.equal(found.amount,100);
  assert.equal(found.kind,'cashback');
  assert.equal(found.percent,10);
  assert.equal(cashBackForTier(1000,5),50);
  assert.equal(Math.min(1000,found.amount),100);
});
test('deal items excluded before computing percentage', () => {
  const items=[
    {productId:'regular',price:500,quantity:2},
    {productId:'weekly',price:600,quantity:1,weeklyDealDay:'Monday'},
  ];
  const eligible=orderEligibleSubtotal(items,{weeklyDeals:[{productId:'weekly',active:true}]});
  assert.equal(eligible,1000);
  assert.equal(resolveCheckoutVoucher([cleanVoucher(promo)],'PRIMEFAMILY',eligible).amount,100);
});
test('inactive, missing, expired and no-eligible items fail closed', () => {
  assert.throws(()=>resolveCheckoutVoucher([cleanVoucher({...promo,active:false})],'PRIMEFAMILY',1000),/invalid or inactive/);
  assert.throws(()=>resolveCheckoutVoucher([cleanVoucher(promo)],'PRIMEFAMILY',0),/not applicable/);
  assert.throws(()=>resolveCheckoutVoucher([cleanVoucher({...promo,expiresAt:'2020-01-01'})],'PRIMEFAMILY',1000),/expired/);
});
test('snapshots enforce one payout and protect legacy pending orders', () => {
  const route=readFileSync(new URL('../app/api/orders/route.ts',import.meta.url),'utf8');
  const delivered=readFileSync(new URL('../lib/deliveredOrderBenefits.ts',import.meta.url),'utf8');
  assert.match(route,/cashbackPercent = voucher \? 0 : tierCashbackPercent/);
  assert.match(route,/voucherRewardMode: voucher \? 'exclusive_v1' : ''/);
  assert.match(delivered,/tierCash = exclusiveVoucher \? 0 : cashBackForTier/);
  assert.match(delivered,/voucherCash !== cashBackForTier\(eligible, voucherPercent\)/);
  assert.match(delivered,/priorCredit\.exists/);
  assert.match(delivered,/voucherClaimRef && !priorVoucher\?\.exists/);
});
