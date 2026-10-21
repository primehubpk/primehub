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
test('default referral disabled; 10% admin validates range, self referral blocked',async()=>{
  assert.equal(referrals.cleanReferralSettings({}).enabled,false);
  assert.equal(referrals.cleanReferralSettings({percent:10,enabled:true}).percent,10);
  assert.throws(()=>referrals.cleanReferralSettings({percent:50}),/between 1% and 20%/);
  assert.equal(referrals.referralCode('primefamily1'),'PRIMEFAMILY1');
  assert.equal(referrals.referralCode('PRIMEFAMILY0'),'');
  assert.equal(referrals.referralCode('PRIMEFAMILY1x'),'');
  await assert.rejects(referrals.resolveMemberReferralCode('PRIMEFAMILY1',buyer,1000),/not yet active/);
  data.set(key('settings','primefamily_referrals'),{enabled:true,percent:10});
  await assert.rejects(referrals.resolveMemberReferralCode('PRIMEFAMILY1',owner,1000),/own referral code/);
  const result=await referrals.resolveMemberReferralCode('PRIMEFAMILY1',buyer,1000);
  assert.equal(result.referrerEarns,100);
  assert.equal(result.kind,'referral');
  assert.equal(result.ownerUid,owner);
});
test('one delivered order credits inviter 10% and buyer 0, idempotently',async()=>{
  const orderId='order-20261021-one';
  const order={status:'pending',source:'website',cashbackPolicy:'delivered_only_v1',
    resellerUserId:buyer,eligibleAfterVoucher:1000,total:1500,cashbackPercent:0,
    voucherKind:'referral',voucherRewardMode:'exclusive_v1',voucherCode:'PRIMEFAMILY1',
    referralOwnerUid:owner,referralPercent:10,referralCashEstimate:100};
  data.set(key('orders',orderId),order);
  const first=await delivered.creditDeliveredOrderBenefits(orderId,order);
  assert.equal(first.reward,0);
  assert.equal(first.referralCash,100);
  assert.equal(data.get(key('reseller_profiles',buyer)).walletAvailable,100);
  assert.equal(data.get(key('reseller_profiles',owner)).walletAvailable,100);
  assert.equal(data.get(key('reseller_referral_credits',orderId)).amount,100);
  const second=await delivered.creditDeliveredOrderBenefits(orderId,order);
  assert.equal(second.alreadyCredited,true);
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
test('tampered self-credit referral snapshot rejects before side effects',async()=>{
  const oid='order-20261021-bad';
  const order={status:'pending',source:'website',cashbackPolicy:'delivered_only_v1',
    resellerUserId:owner,eligibleAfterVoucher:1000,total:1500,cashbackPercent:0,
    voucherKind:'referral',voucherRewardMode:'exclusive_v1',voucherCode:'PRIMEFAMILY1',
    referralOwnerUid:owner,referralPercent:10,referralCashEstimate:100};
  data.set(key('orders',oid),order);
  await assert.rejects(delivered.creditDeliveredOrderBenefits(oid,order),/Invalid referral reward snapshot/);
  assert.equal(data.has(key('reseller_rewards',oid)),false);
});
