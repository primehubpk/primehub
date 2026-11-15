import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';
const code=stripTypeScriptTypes(fs.readFileSync(new URL('../lib/shuffleProducts.ts',import.meta.url),'utf8'))
  .replace(/^import .*;$/gm,'').replace(/export function /g,'function ');
const context={isWholesaleProduct:()=>false,Math,Date};vm.createContext(context);vm.runInContext(code,context);
const {shuffleForVisit,recentProductsForVisit}=context;
const products=Array.from({length:50},(_,i)=>({id:'p'+i,price:i+100,image:'image-'+i,variantMatrix:[{size:'2.2',price:i+100}]}));
const ids=items=>Array.from(items,x=>x.id);
test('same visit remains stable across timer renders, refetches and input order',()=>{
  const expected=ids(shuffleForVisit(products,555,'bogo'));
  assert.deepEqual(ids(shuffleForVisit([...products].reverse(),555,'bogo')),expected);
  assert.deepEqual(ids(shuffleForVisit(products.map(p=>({...p,price:p.price+10})),555,'bogo')),expected);
});
test('fresh visit seeds change presentation while preserving every actual product',()=>{
  const first=shuffleForVisit(products,1,'bogo'),second=shuffleForVisit(products,2,'bogo');
  assert.notDeepEqual(ids(first),ids(second));
  assert.deepEqual(ids(first).sort(),ids(products).sort());
  assert.equal(first.length,50);assert.equal(new Set(ids(first)).size,50);
  for(const p of first)assert.equal(p,products.find(original=>original.id===p.id));
  assert.equal(products[0].id,'p0');
});
test('Mega Deals wrapper identity and collection namespaces remain stable',()=>{
  const offers=products.map(product=>({product,price:product.price}));
  const first=Array.from(shuffleForVisit(offers,7,'mega'),x=>x.product.id);
  assert.deepEqual(first,Array.from(shuffleForVisit([...offers].reverse(),7,'mega'),x=>x.product.id));
  assert.notDeepEqual(first,Array.from(shuffleForVisit(offers,7,'bogo'),x=>x.product.id));
});


test('new visits lead with recent uploads and preserve all exact product objects',()=>{
 const catalog=Array.from({length:40},(_,i)=>({id:'p'+i,createdAt:new Date(Date.UTC(2026,10,i+1)).toISOString(),price:i+99}));
 const first=recentProductsForVisit(catalog,10,'category');
 const second=recentProductsForVisit(catalog,20,'category',first[0].id);
 assert.notEqual(second[0].id,first[0].id);
 assert.deepEqual(ids(second).sort(),ids(catalog).sort());
 assert.ok(second.slice(0,10).every(p=>Number(p.id.slice(1))>=30));
 assert.deepEqual(ids(recentProductsForVisit([...catalog].reverse(),20,'category',first[0].id)),ids(second));
 assert.ok(second.every(p=>p===catalog.find(original=>original.id===p.id)));
});
test('single products stay real while two-product collections change their first card',()=>{
 const a={id:'a'},b={id:'b'};
 assert.deepEqual(ids(recentProductsForVisit([a],1,'one','a')),['a']);
 assert.deepEqual(ids(recentProductsForVisit([a,b],1,'two','a')),['b','a']);
 assert.deepEqual(ids(recentProductsForVisit([],1,'empty')),[]);
});
