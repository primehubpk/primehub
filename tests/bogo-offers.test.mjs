import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../lib/bogoOffers.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
vm.runInNewContext(compiled, { exports, Date, Map, Number, String, Math });
const { bogoWindow, resolveBogoSettings, bogoFulfilment, validateBogoOrder, applyBogoAvailability } = exports;
const midnight = Date.parse('2026-11-12T19:00:00.000Z');
const product = { id:'bogo-real', title:'Set', stock:30, price:400,
  bogoOffer:{enabled:true,unitsPerOffer:2,unitLabel:'set'},
  variantMatrix:[{id:'small',color:'Gold',size:'2.2',stock:3,active:true},{id:'large',color:'Gold',size:'2.8',stock:0,active:true},{id:'hidden',color:'Gold',size:'2.6',stock:30,hidden:true}] };
const selection = {color:'Gold',size:'2.2'};

test('daily timer resets exactly at Pakistan midnight, not browser local time', () => {
  assert.equal(bogoWindow(undefined,midnight-1000).remaining,1);
  assert.equal(bogoWindow(undefined,midnight).remaining,86400);
  assert.equal(bogoWindow(undefined,midnight).endsAt,midnight+86400000);
  assert.equal(bogoWindow(undefined,midnight+86400000).live,true);
});
test('pause wins over renewal and malformed or expired fixed windows stay closed', () => {
  assert.equal(bogoWindow({enabled:false},midnight).live,false);
  assert.equal(bogoWindow({autoRenew:false,endsAt:'bad'},midnight).live,false);
  assert.equal(bogoWindow({autoRenew:false,endsAt:new Date(midnight).toISOString()},midnight).live,false);
  assert.equal(bogoWindow({autoRenew:false,endsAt:new Date(midnight+1000).toISOString()},midnight).live,true);
  assert.equal(resolveBogoSettings({enabled:false}).enabled,false);
});
test('free units are server derived, exact two packs per paid offer', () => {
  const offer=bogoFulfilment(product,3);
  assert.equal(offer.paidPacks,3);assert.equal(offer.freePacks,3);assert.equal(offer.totalPacks,6);assert.equal(offer.sameVariant,true);
  assert.equal(bogoFulfilment({id:'ordinary'},3),null);
});
test('exact active saved size required, explicit zero and hidden rows stay unavailable', () => {
  validateBogoOrder(product,selection,1,undefined,new Map(),midnight);
  for(const option of [undefined,{size:'9',color:'Gold'},{size:'2.8',color:'Gold'},{size:'2.6',color:'Gold'}]) {
    assert.throws(()=>validateBogoOrder(product,option,1,undefined,new Map(),midnight));
  }
});
test('stock caps aggregate repeated cart lines and different variants', () => {
  const used=new Map();validateBogoOrder(product,selection,2,undefined,used,midnight);
  assert.throws(()=>validateBogoOrder(product,selection,2,undefined,used,midnight),/stock/);
  const parent={...product,stock:1};assert.throws(()=>validateBogoOrder(parent,selection,2,undefined,new Map(),midnight),/stock/);
});
test('renewal cannot restore sold out stock; default only applies when absent', () => {
  for(const time of [midnight-1000,midnight,midnight+86400000]) {
    assert.throws(()=>validateBogoOrder({...product,stock:0},selection,1,undefined,new Map(),time),/stock/);
  }
  validateBogoOrder({id:'plain',bogoOffer:product.bogoOffer},undefined,30,undefined,new Map(),midnight);
  assert.throws(()=>validateBogoOrder({id:'plain',bogoOffer:product.bogoOffer},undefined,31,undefined,new Map(),midnight),/stock/);
});
test('paused or unpublished offer cannot be ordered and public view is unavailable', () => {
  assert.throws(()=>validateBogoOrder(product,selection,1,{enabled:false},new Map(),midnight),/not currently live/);
  assert.throws(()=>validateBogoOrder({...product,published:false},selection,1,undefined,new Map(),midnight));
  assert.equal(applyBogoAvailability(product,{enabled:false}).stock,0);
  assert.equal(product.stock,30);
});
test('fifty separate source photos preserve folder prices and real size sets', () => {
  const products=JSON.parse(fs.readFileSync(new URL('../data/bogo-staged-products.json',import.meta.url)));
  assert.equal(products.length,50);assert.equal(new Set(products.map(p=>p.id)).size,50);assert.equal(new Set(products.map(p=>p.sourceAsset.sha256)).size,50);
  for(const p of products){
    const parts=p.sourceAsset.folder.match(/\d+/g).map(Number);
    assert.equal(p.price,parts.at(-1));assert.ok(p.sourceAsset.bytes<=100000);
    assert.match(p.imageUrl,/^https:\/\/images\.primehubmall\.com\//);
    assert.deepEqual(p.variantSizes,parts.slice(0,-1).filter(n=>n>=20&&n<=30).map(n=>(n/10).toFixed(1)));
    assert.equal(p.bogoOffer.unitsPerOffer,2);assert.equal(p.stock,30);
    assert.ok(p.variantMatrix.every(v=>v.price===p.price&&v.stock===30));
  }
});
test('staged photo catalogue is excluded from production and Vercel', () => {
  const stageSource=fs.readFileSync(new URL('../lib/stagedBogoCatalogServer.ts',import.meta.url),'utf8');
  const code=ts.transpileModule(stageSource,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  for(const env of [{NODE_ENV:'production'},{NODE_ENV:'development',VERCEL:'1'},{NODE_ENV:'development',VERCEL_ENV:'preview'},{NODE_ENV:'development'}]){
    const result={};vm.runInNewContext(code,{exports:result,process:{env},require:(name)=>name==='server-only'?{}:{default:[{id:'photo'}]}});
    assert.equal(result.stagedBogoProducts().length,env.NODE_ENV==='development'&&!env.VERCEL&&!env.VERCEL_ENV?1:0);
  }
});
