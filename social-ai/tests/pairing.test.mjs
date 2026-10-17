import test from 'node:test';
import assert from 'node:assert/strict';
import { executePairing } from '../lib/pairing-backend.mjs';
import handler from '../api/pair.js';

function fakeRes(){
 return {
   code:200,headers:{},value:null,
   setHeader(k,v){this.headers[k]=v;return this;},
   status(s){this.code=s;return this;},
   json(v){this.value=v;return this;},
   end(){return this;}
 };
}

test('pairing rejects arbitrary operations, device identity, and short owner codes',async()=>{
 await assert.rejects(executePairing('remote_click',{code:'A'.repeat(26)}),/Unknown pairing/);
 await assert.rejects(executePairing('begin',{deviceId:'not-a-device',deviceToken:'no',code:'A'.repeat(26)}),/Invalid device/);
 await assert.rejects(executePairing('status',{code:'SHORT'}),/26-character/);
});
test('owner device pairing endpoint accepts only POST JSON and rejects unexpected origins',async()=>{
 const methods=['GET','PUT','DELETE'];
 for(const method of methods){
  const res=fakeRes();
  await handler({method,headers:{},body:{}},res);
  assert.equal(res.code,405);
 }
 const res=fakeRes();
 await handler({method:'POST',headers:{origin:'https://untrusted.example','content-type':'application/json'},body:{action:'status',code:'A'.repeat(26)}},res);
 assert.equal(res.code,403);
 const txt=fakeRes();
 await handler({method:'POST',headers:{'content-type':'text/plain'},body:{}},txt);
 assert.equal(txt.code,415);
 const huge=fakeRes();
 await handler({method:'POST',headers:{'content-length':'2000','content-type':'application/json'},body:{}},huge);
 assert.equal(huge.code,413);
});
test('only safe device-status operations are available; no remote phone control',async()=>{
 const res=fakeRes();
 await handler({method:'POST',headers:{'content-type':'application/json'},body:{action:'screenshot'}},res);
 assert.equal(res.code,400);
});
