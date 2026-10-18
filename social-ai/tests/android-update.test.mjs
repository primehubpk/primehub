import test from 'node:test';
import assert from 'node:assert/strict';
import updater from '../api/android-update.js';

function fakeRes(){
 return {statusCode:200,headers:{},data:null,
  setHeader(k,v){this.headers[k.toLowerCase()]=v;return this;},
  status(n){this.statusCode=n;return this;},
  json(v){this.data=v;return this;}
 };
}
test('reject methods other than GET',async()=>{
 const r=fakeRes();await updater({method:'POST'},r);
 assert.equal(r.statusCode,405);
});
test('no signed release does not advertise a fake install',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async()=>({ok:true,json:async()=>[]});
 try{const r=fakeRes();await updater({method:'GET'},r);assert.equal(r.statusCode,200);assert.equal(r.data.versionCode,0);assert.equal(r.data.status,'not_published');}
 finally{globalThis.fetch=original;}
});
test('only signed PrimeHub Social AI releases are offered',async()=>{
 const original=globalThis.fetch;
 const sha='1'.repeat(64);
 globalThis.fetch=async()=>({ok:true,json:async()=>[
  {tag_name:'social-ai-v4',draft:false,prerelease:false,name:'v4',assets:[{name:'primehub-social-ai-debug.apk',digest:'sha256:'+sha}]},
  {tag_name:'shopping-v999',draft:false,prerelease:false,assets:[{name:'primehub-social-ai-debug.apk',digest:'sha256:'+sha}]},
  {tag_name:'social-ai-v5',draft:true,prerelease:false,assets:[{name:'primehub-social-ai-debug.apk',digest:'sha256:'+sha}]},
  {tag_name:'social-ai-v9',draft:false,prerelease:false,assets:[{name:'primehub-social-ai-debug.apk',digest:'invalid'}]},
  {tag_name:'social-ai-v3',draft:false,prerelease:false,assets:[{name:'primehub-social-ai-debug.apk',digest:'sha256:'+sha}]}
 ]});
 try{
  const r=fakeRes();await updater({method:'GET'},r);
  assert.equal(r.statusCode,200);assert.equal(r.data.versionCode,4);
  assert.equal(r.data.apkUrl,'https://github.com/primehubpk/primehub/releases/download/social-ai-v4/primehub-social-ai-debug.apk');
  assert.equal(r.data.sha256,sha);
  assert.equal(r.data.packageName,'com.primehub.socialai.debug');
 }finally{globalThis.fetch=original;}
});
