import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {createHash} from 'node:crypto';

const data = new Map();
const key = (collection, id) => `${collection}/${id}`;
const field = {serverTimestamp:()=>new Date('2026-10-21T06:00:00.000Z')};
const snapshot = (name) => ({
  exists:data.has(name),
  data:()=>data.get(name),
  createTime:{toDate:()=>new Date('2026-10-21')},
});
const database = {
  collection(name) {
    return {
      doc(id) {
        const lookup=key(name,id);
        return {lookup, get:async()=>snapshot(lookup),
          set:async (value)=>data.set(lookup,value),
          update:async (value)=>data.set(lookup,{...data.get(lookup),...value})};
      },
    };
  },
  async runTransaction(action) {
    const mutations=[];
    const tx = {
      get:async ref=>snapshot(ref.lookup),
      create(ref,value){mutations.push(['create',ref.lookup,value])},
      update(ref,value){mutations.push(['update',ref.lookup,value])},
      set(ref,value,opts){mutations.push(['set',ref.lookup,value,opts])},
    };
    const result=await action(tx);
    for(const [action,key,value,opts] of mutations){
      if(action==='create' && data.has(key)) throw Error('ALREADY_EXISTS: '+key);
      if(action==='update' && !data.has(key)) throw Error('NOT_FOUND: '+key);
      data.set(key,action==='update'||(action==='set'&&opts?.merge)?{...data.get(key),...value}:value);
    }
    return result;
  },
};
const cashBackForTier=(subtotal, percent)=>Math.min(subtotal,Math.round(subtotal*percent/100));
const mocks={
  'server-only':{},
  'firebase-admin/firestore':{FieldValue:field},
  '@/lib/firebaseAdmin':{getAdminDb:()=>database},
  '@/lib/orderBenefits':{cashBackForTier},
  '@/lib/resellerDualMirror':{mirrorResellerFirestoreDoc:async()=>{}},
  'node:crypto':{createHash},
};
function load(path,extra={}) {
  const source=readFileSync(new URL('../'+path,import.meta.url),'utf8');
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}};
  vm.runInNewContext(js,{module,exports:module.exports,require:(n)=>{
    if(n in extra)return extra[n];
    if(n in mocks)return mocks[n];
    throw Error('Unexpected module '+n);
  },Date,Intl,Number,String,Promise,Set,console},{timeout:2000,filename:path});
  return module.exports;
}
const referrals=load('lib/primeFamilyReferralsServer.ts');
const delivered=load('lib/deliveredOrderBenefits.ts',{'@/lib/primeFamilyReferralsServer':{referralCode:referrals.referralCode}});
const owner='owner012345678901234567890', buyer='buyer012345678901234567890', buyer2='buyer112345678901234567890';

test('unique sequential PRIMEFAMILY1, PRIMEFAMILY2 codes stable on retries',async()=>{
  data.clear();
  for(const uid of [owner,buyer,buyer2]){
    data.set(key('reseller_profiles',uid),{status:'active',email:uid+'@example.com',walletAvailable:uid===buyer?100:0,monthlyOrders:0});
  }
  assert.equal(await referrals.ensureMemberReferralCode(owner),'PRIMEFAMILY1');
  assert.equal(await referrals.ensureMemberReferralCode(owner),'PRIMEFAMILY1');
  assert.equal(await referrals.ensureMemberReferralCode(buyer),'PRIMEFAMILY2');
  assert.equal(data.get(key('reseller_referral_counter','primary')).nextSequence,3);
  assert.equal(data.get(key('reseller_referral_codes','PRIMEFAMILY1')).ownerUid,owner);
});
test('default referral disabled; 10% admin validates range, own code allowed',async()=>{
  assert.equal(referrals.cleanReferralSettings({}).enabled,false);
  assert.equal(referrals.cleanReferralSettings({percent:10,enabled:true}).percent,10);
  assert.throws(()=>referrals.cleanReferralSettings({percent:50}),/between 1% and 20%/);
  assert.equal(referrals.referralCode('primefamily1'),'PRIMEFAMILY1');
  assert.equal(referrals.referralCode('PRIMEFAMILY0'),'');
  assert.equal(referrals.referralCode('PRIMEFAMILY1x'),'');
  await assert.rejects(referrals.resolveMemberReferralCode('PRIMEFAMILY1',buyer,1000),/not yet active/);
  data.set(key('settings','primefamily_referrals'),{enabled:true,percent:10});
  const own=await referrals.resolveMemberReferralCode('PRIMEFAMILY1',owner,1000);
  assert.equal(own.referrerEarns,100);
  assert.equal(own.ownerUid,owner);
  const result=await referrals.resolveMemberReferralCode('PRIMEFAMILY1',buyer,1000);
  assert.equal(result.referrerEarns,100);
  assert.equal(result.kind,'referral');
  assert.equal(result.ownerUid,owner);
});
test('one delivered order credits buyer 10% and inviter 10% without tier stacking, idempotently',async()=>{
  const orderId='order-20261021-one';
  const order={status:'pending',source:'website',cashbackPolicy:'delivered_only_v1',
    resellerUserId:buyer,eligibleAfterVoucher:1000,total:1500,cashbackPercent:0,
    voucherKind:'referral',voucherRewardMode:'exclusive_v1',voucherCode:'PRIMEFAMILY1',
    referralOwnerUid:owner,referralPercent:10,referralCashEstimate:100};
  data.set(key('orders',orderId),order);
  const first=await delivered.creditDeliveredOrderBenefits(orderId,order);
  assert.equal(first.reward,100);
  assert.equal(first.buyerReferralCash,100);
  assert.equal(first.referralCash,100);
  assert.equal(data.get(key('reseller_profiles',buyer)).walletAvailable,200);
  assert.equal(data.get(key('reseller_profiles',owner)).walletAvailable,100);
  assert.equal(data.get(key('reseller_referral_credits',orderId)).amount,100);
  const second=await delivered.creditDeliveredOrderBenefits(orderId,order);
  assert.equal(second.alreadyCredited,true);
  assert.equal(second.buyerReferralCash,100);
  assert.equal(data.get(key('reseller_profiles',buyer)).walletAvailable,200);
  assert.equal(data.get(key('reseller_profiles',owner)).walletAvailable,100);
  assert.equal(data.get(key('reseller_profiles',buyer)).monthlyOrders,1);
});
test('second distinct delivered order rewards inviter again; same order cannot duplicate',async()=>{
  const orderId='order-20261021-two';
  const order={status:'pending',source:'website',cashbackPolicy:'delivered_only_v1',
    resellerUserId:buyer,eligibleAfterVoucher:1000,total:1500,cashbackPercent:0,
    voucherKind:'referral',voucherRewardMode:'exclusive_v1',voucherCode:'PRIMEFAMILY1',
    referralOwnerUid:owner,referralPercent:10,referralCashEstimate:100};
  data.set(key('orders',orderId),order);
  const result=await delivered.creditDeliveredOrderBenefits(orderId,order);
  assert.equal(result.referralCash,100);
  assert.equal(data.get(key('reseller_referral_credits',orderId)).amount,100);
  assert.equal(data.get(key('reseller_profiles',owner)).walletAvailable,200);
  const validAgain=await referrals.resolveMemberReferralCode('PRIMEFAMILY1',buyer,1000);
  assert.equal(validAgain.referrerEarns,100);
});
test('own referral delivers 10% shopping credit once without stacking tier or overwriting order count',async()=>{
  const oid='order-20261021-self';
  const order={status:'pending',source:'website',cashbackPolicy:'delivered_only_v1',
    rewardSettlementMode:'shopping_only_v1',resellerUserId:owner,
    eligibleAfterVoucher:1000,total:1500,cashbackPercent:5,
    voucherKind:'referral',voucherRewardMode:'exclusive_v1',voucherCode:'PRIMEFAMILY1',
    referralOwnerUid:owner,referralPercent:10,referralCashEstimate:100};
  data.set(key('orders',oid),order);
  const before=data.get(key('reseller_profiles',owner));
  const beforeShopping=data.get(key('reseller_shopping_wallets',owner))?.balance || 0;
  const beforeCash=before.walletAvailable;
  const beforeOrders=before.monthlyOrders;
  const first=await delivered.creditDeliveredOrderBenefits(oid,order);
  assert.equal(first.reward,100); // Own code pays 10% once; tier 5% cannot stack.
  assert.equal(first.cashback,0);
  assert.equal(first.referralCash,100);
  assert.equal(first.buyerReferralCash,0); // Prevent doubling own code.
  assert.equal(data.get(key('reseller_rewards',oid)).amount,100);
  assert.equal(data.get(key('reseller_shopping_wallets',owner)).balance,beforeShopping+100);
  assert.equal(data.get(key('reseller_profiles',owner)).walletShopping,beforeShopping+100);
  assert.equal(data.get(key('reseller_profiles',owner)).walletAvailable,beforeCash);
  assert.equal(data.get(key('reseller_profiles',owner)).monthlyOrders,beforeOrders+1);
  assert.equal(data.get(key('reseller_referral_credits',oid)).buyerUid,owner);
  const second=await delivered.creditDeliveredOrderBenefits(oid,order);
  assert.equal(second.alreadyCredited,true);
  assert.equal(data.get(key('reseller_shopping_wallets',owner)).balance,beforeShopping+100);
  assert.equal(data.get(key('reseller_profiles',owner)).monthlyOrders,beforeOrders+1);
});
test('without a referral voucher the same member gets normal tier-only cashback',async()=>{
  const oid='order-20261021-tier';
  const order={status:'pending',source:'website',cashbackPolicy:'delivered_only_v1',
    rewardSettlementMode:'shopping_only_v1',resellerUserId:owner,
    eligibleAfterVoucher:1000,total:1500,cashbackPercent:5,voucherKind:''};
  data.set(key('orders',oid),order);
  const beforeShopping=data.get(key('reseller_shopping_wallets',owner)).balance;
  const first=await delivered.creditDeliveredOrderBenefits(oid,order);
  assert.equal(first.reward,50);
  assert.equal(first.cashback,50);
  assert.equal(first.referralCash,0);
  assert.equal(data.get(key('reseller_shopping_wallets',owner)).balance,beforeShopping+50);
  assert.equal(data.has(key('reseller_referral_credits',oid)),false);
});


test('legacy reward-excluded order snapshots stay protected; no retroactive credit',async()=>{
  data.clear();
  data.set(key('reseller_profiles',owner),{status:'active',walletAvailable:0,monthlyOrders:0});
  const cases=[
    {id:'order-cashback-promo-bogo', kind:'referral'},
    {id:'order-cashback-promo-glass', kind:'tier'},
  ];
  for(const tc of cases){
    const order={status:'pending',source:'website',cashbackPolicy:'delivered_only_v1',
      rewardSettlementMode:'shopping_only_v1',resellerUserId:owner,
      eligibleAfterVoucher:tc.kind==='referral'?440:1099,total:1500,cashbackPercent:10,
      items:[{productId:tc.kind==='referral'?'bogo-test':'glass-test',
        price:tc.kind==='referral'?440:1099,quantity:1,
        rewardExcluded:true,dealCategory:tc.kind==='referral'?'bogo':'mega',
        ...(tc.kind==='referral'?{promotion:{type:'buy-one-get-one-free'}}:{})}],
      ...(tc.kind==='referral'?{
        voucherKind:'referral',voucherRewardMode:'exclusive_v1',voucherCode:'PRIMEFAMILY1',
        referralOwnerUid:owner,referralPercent:10,referralCashEstimate:44,
      }:{voucherKind:''}),
    };
    data.set(key('orders',tc.id),order);
    await assert.rejects(delivered.creditDeliveredOrderBenefits(tc.id,order),
      /Order cashback exceeds the verified eligible paid items/);
    assert.equal(data.has(key('reseller_rewards',tc.id)),false);
    assert.equal(data.has(key('reseller_referral_credits',tc.id)),false);
    assert.equal(data.get(key('reseller_profiles',owner)).walletAvailable,0);
  }
});

test('new Mega and BOGO paid packs earn tier cashback only once after Delivered',async()=>{
  data.clear();
  data.set(key('reseller_profiles',buyer),{status:'active',walletAvailable:0,monthlyOrders:0});
  const oid='order-20261115-tier-mega-bogo';
  const order={
    status:'pending',source:'website',cashbackPolicy:'delivered_only_v1',
    rewardSettlementMode:'shopping_only_v1',resellerUserId:buyer,
    eligibleAfterVoucher:1539,total:1889,cashbackPercent:10,voucherKind:'',
    items:[
      {productId:'glass-mega',price:1099,quantity:1,dealCategory:'mega',rewardExcluded:false},
      {productId:'bogo-product',price:440,quantity:1,dealCategory:'bogo',
        rewardExcluded:false,promotion:{type:'buy-one-get-one-free',paidPacks:1,freePacks:1}},
    ],
  };
  data.set(key('orders',oid),order);
  const first=await delivered.creditDeliveredOrderBenefits(oid,order);
  assert.equal(first.cashback,154);
  assert.equal(first.referralCash,0);
  assert.equal(data.get(key('reseller_shopping_wallets',buyer)).balance,154);
  assert.equal(data.get(key('reseller_profiles',buyer)).walletAvailable,0);
  assert.equal(data.get(key('reseller_rewards',oid)).cashback,154);
  const again=await delivered.creditDeliveredOrderBenefits(oid,order);
  assert.equal(again.alreadyCredited,true);
  assert.equal(data.get(key('reseller_shopping_wallets',buyer)).balance,154);
});

test('friend code on BOGO pays buyer and inviter 10 percent each, instead of buyer tier',async()=>{
  data.clear();
  for(const uid of [owner,buyer])
    data.set(key('reseller_profiles',uid),{status:'active',walletAvailable:0,monthlyOrders:0});
  data.set(key('reseller_referral_codes','PRIMEFAMILY1'),{code:'PRIMEFAMILY1',ownerUid:owner});
  const oid='order-20261115-bogo-referral';
  const order={
    status:'pending',source:'website',cashbackPolicy:'delivered_only_v1',
    rewardSettlementMode:'shopping_only_v1',resellerUserId:buyer,
    eligibleAfterVoucher:440,total:790,cashbackPercent:0,
    voucherKind:'referral',voucherRewardMode:'exclusive_v1',voucherCode:'PRIMEFAMILY1',
    referralOwnerUid:owner,referralPercent:10,referralCashEstimate:44,
    items:[{productId:'bogo-product',price:440,quantity:1,dealCategory:'bogo',
      rewardExcluded:false,promotion:{type:'buy-one-get-one-free',paidPacks:1,freePacks:1}}],
  };
  data.set(key('orders',oid),order);
  const first=await delivered.creditDeliveredOrderBenefits(oid,order);
  assert.equal(first.reward,44);
  assert.equal(first.cashback,0);
  assert.equal(first.buyerReferralCash,44);
  assert.equal(first.referralCash,44);
  assert.equal(data.get(key('reseller_shopping_wallets',owner)).balance,44);
  assert.equal(data.get(key('reseller_shopping_wallets',buyer)).balance,44);
  assert.equal(data.get(key('reseller_referral_credits',oid)).amount,44);
  const second=await delivered.creditDeliveredOrderBenefits(oid,order);
  assert.equal(second.alreadyCredited,true);
  assert.equal(data.get(key('reseller_shopping_wallets',owner)).balance,44);
  assert.equal(data.get(key('reseller_shopping_wallets',buyer)).balance,44);
});
