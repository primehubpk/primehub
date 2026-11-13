import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as nodeCrypto from 'node:crypto';

function loadPureExports(path) {
  const source = readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}
  }).outputText;
  const module = {exports: {}};
  vm.runInNewContext(js, {
    module, exports: module.exports,
    require: name => name === './glassOffers' ? loadPureExports('lib/glassOffers.ts') : name === 'node:crypto' ? nodeCrypto : name === '@/lib/walletAdminSession' ? loadPureExports('lib/walletAdminSession.ts') : name === 'next/server' ? {NextResponse:{json(value,init){const r=Response.json(value,init);r.cookieWrites=[];r.cookies={set:(...args)=>r.cookieWrites.push(args)};return r;}}} : name === '@/lib/integrations/tiktokPostingSession' ? {POSTING_SESSION_COOKIE:'posting-test',postingSessionCookieOptions:()=>({httpOnly:true,path:'/'})} : ({}), console, Intl, Date, Number, String, Set, Buffer, Request, Response, URL,
    process: {env: {FIREBASE_SERVICE_ACCOUNT_KEY: JSON.stringify({private_key: 'PRIVATE KEY test fixture only'})}},
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


const {allocateShoppingCash}=loadPureExports('lib/resellerShoppingCheckout.ts');
test('Mega and authoritative BOGO flags exclude all wallet, voucher and cashback benefits in mixed carts',()=>{
 const settings={glassDealShowcase:{enabled:true,collectionVersion:2,items:[{productId:'mega'}]}};
 const items=[{productId:'regular',price:500,quantity:2}, {productId:'mega',price:400,quantity:1},
  {productId:'bogo',price:200,quantity:1,rewardExcluded:true}];
 const eligible=orderEligibleSubtotal(items,settings);
 assert.equal(eligible,1000);
 assert.equal(cashBackForTier(eligible,10),100);
 const discount=resolveCheckoutVoucher([cleanVoucher({...promo,kind:'discount',amount:150,percent:0})],'PRIMEFAMILY',eligible).amount;
 assert.equal(discount,150);
 const allocation=allocateShoppingCash(5000,1000,1600-discount+350,eligible-discount);
 assert.equal(allocation.amount,850);
 assert.equal(allocation.amountDue,400+200+350);
 const offersOnly=orderEligibleSubtotal(items.slice(1),settings);
 assert.equal(offersOnly,0);
 assert.equal(allocateShoppingCash(5000,1000,600,offersOnly).amount,0);
 assert.equal(cashBackForTier(offersOnly,10),0);
 assert.throws(()=>resolveCheckoutVoucher([cleanVoucher(promo)],'PRIMEFAMILY',offersOnly),/not applicable/);
});
test('checkout derives BOGO exclusion from the fresh server product and uses eligible-only debit',()=>{
 const route=readFileSync(new URL('../app/api/orders/route.ts',import.meta.url),'utf8');
 const debit=readFileSync(new URL('../lib/resellerShoppingCheckout.ts',import.meta.url),'utf8');
 assert.match(route,/rewardExcluded: isBogoProduct\(product\) \|\| isMegaDealItem/);
 assert.match(route,/Math\.min\(walletShoppingBalance, eligibleAfterVoucher\)/);
 assert.match(debit,/allocateShoppingCash\(shopping, withdrawable, orderData\.total, Number\(orderData\.eligibleAfterVoucher/);
});
const admin=loadPureExports('lib/walletAdminSession.ts');
const adminRequest=token=>new Request('https://store.test/admin',{headers:{cookie:token ? `${admin.WALLET_ADMIN_COOKIE}=${token}` : ''}});
test('remembered admin survives four hours and browser-close intervals while the signed token remains required',()=>{
 const token=admin.issueWalletAdminSession(100000);
 assert.equal(admin.authorizedWalletAdmin(adminRequest(token),100000+4*3600+1),true);
 assert.equal(admin.authorizedWalletAdmin(adminRequest(token),100000+365*86400),true);
 assert.equal(admin.walletAdminCookieOptions().httpOnly,true);
 assert.equal(admin.walletAdminCookieOptions().maxAge,400*86400);
 assert.equal(admin.authorizedWalletAdmin(adminRequest(token),100000+400*86400),false);
});
test('remembered admin rejects missing, forged, future and hint-only credentials',()=>{
 const token=admin.issueWalletAdminSession(100000);
 assert.equal(admin.authorizedWalletAdmin(adminRequest(''),100001),false);
 assert.equal(admin.authorizedWalletAdmin(adminRequest(token+'x'),100001),false);
 assert.equal(admin.authorizedWalletAdmin(adminRequest(token),99999),false);
 assert.equal(admin.authorizedWalletAdmin(new Request('https://store.test/admin',{headers:{cookie:'primehub_admin_auth=true'}}),100001),false);
});

const adminRoute=loadPureExports('app/api/admin/session/route.ts');
test('valid admin visits renew the remembered device; forged visits cannot mint a session',async()=>{
 const token=admin.issueWalletAdminSession();
 const response=await adminRoute.GET(adminRequest(token));
 assert.equal((await response.json()).authenticated,true);
 const renewed=response.cookieWrites.find(([name])=>name===admin.WALLET_ADMIN_COOKIE);
 assert.ok(renewed);
 assert.notEqual(renewed[1],token);
 assert.equal(renewed[2].maxAge,400*86400);
 assert.equal(admin.authorizedWalletAdmin(adminRequest(renewed[1])),true);
 const denied=await adminRoute.GET(adminRequest(token+'forged'));
 assert.equal((await denied.json()).authenticated,false);
 assert.equal(denied.cookieWrites.length,0);
});
test('explicit same-origin logout clears remembered cookies; cross-origin logout is rejected',async()=>{
 const logout=await adminRoute.DELETE(new Request('https://store.test/api/admin/session',{method:'DELETE',headers:{origin:'https://store.test'}}));
 assert.equal(logout.status,200);
 assert.ok(logout.cookieWrites.some(([name,value,opts])=>name===admin.WALLET_ADMIN_COOKIE&&value===''&&opts.maxAge===0));
 const denied=await adminRoute.DELETE(new Request('https://store.test/api/admin/session',{method:'DELETE',headers:{origin:'https://other.test'}}));
 assert.equal(denied.status,403);
 assert.equal(denied.cookieWrites.length,0);
});
