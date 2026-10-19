import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createState,parseState,loginUrl,oauthReady,REDIRECT} from '../lib/tiktok-login.mjs';
import tiktok from '../api/tiktok-account.js';
import callback from '../api/tiktok-callback.js';

const stateEnv='PH_SOCIAL_TIKTOK_STATE_KEY',clientEnv='PH_SOCIAL_TIKTOK_CLIENT_KEY',secretEnv='PH_SOCIAL_TIKTOK_CLIENT_SECRET',proofEnv='PH_SOCIAL_TIKTOK_SERVER_PROOF';
const prior=[process.env[stateEnv],process.env[clientEnv],process.env[secretEnv],process.env[proofEnv]];
function runEnv(action){
  try{
    process.env[stateEnv]=Buffer.alloc(32,7).toString('base64url');
    process.env[clientEnv]='test-only-public-client-key';
    process.env[secretEnv]='test-only-private-client-secret';
    process.env[proofEnv]='test-only-backend-proof'.repeat(3);
    action();
  }finally{
    [stateEnv,clientEnv,secretEnv,proofEnv].forEach((key,i)=>{
      if(prior[i]===undefined)delete process.env[key];else process.env[key]=prior[i];
    });
  }
}
const makeRes=()=>({statusCode:200,headers:{},result:null,redirected:null,
  setHeader(k,v){this.headers[k.toLowerCase()]=v;return this},
  status(v){this.statusCode=v;return this},
  json(v){this.result=v;return this},
  redirect(n,u){this.statusCode=n;this.redirected=u;return this},
  end(){return this}
});
test('creates official TikTok authorization URL only from verified server-side config',()=>{
 runEnv(()=>{
   assert.equal(oauthReady(),true);
   const u=new URL(loginUrl('state-test'));
   assert.equal(u.hostname,'www.tiktok.com');
   assert.equal(u.pathname,'/v2/auth/authorize/');
   assert.equal(u.searchParams.get('redirect_uri'),REDIRECT);
   assert.equal(u.searchParams.get('response_type'),'code');
   assert.equal(u.searchParams.get('scope'),'user.info.basic');
   assert.equal(u.searchParams.get('disable_auto_auth'),'1');
 });
});
test('device OAuth state encrypted, signed and expires after ten minutes',()=>{
 runEnv(()=>{
   const id=randomUUID(),token='3'.repeat(64),now=1_800_000_000_000;
   const state=createState(id,token,now);
   assert.ok(!state.includes(token));
   const parsed=parseState(state,now+60_000);
   assert.equal(parsed.id,id);assert.equal(parsed.token,token);
   assert.throws(()=>parseState(state,now+660_000),/expired/);
   const bytes=Buffer.from(state,'base64url');
   bytes[14]^=1;
   assert.throws(()=>parseState(bytes.toString('base64url')));
 });
});
test('account setup indicator is explicit, not a fake login',async()=>{
 const res=makeRes();
 const oldKey=process.env[clientEnv],oldSecret=process.env[secretEnv];
 delete process.env[clientEnv];delete process.env[secretEnv];
 try {
  await tiktok({method:'GET',headers:{}},res);
  assert.equal(res.result.loginKitReady,false);
  assert.equal(res.result.automaticPosting,false);
  const denied=makeRes();
  await tiktok({method:'POST',headers:{'content-type':'application/json'},
    body:{action:'begin',deviceId:randomUUID(),deviceToken:'a'.repeat(64)}},denied);
  assert.equal(denied.statusCode,409);
  assert.equal(denied.result.setupRequired,true);
 }finally{
   if(oldKey===undefined)delete process.env[clientEnv];else process.env[clientEnv]=oldKey;
   if(oldSecret===undefined)delete process.env[secretEnv];else process.env[secretEnv]=oldSecret;
 }
});
test('rejects untrusted browser origins or device credentials',async()=>{
 const r=makeRes();
 await tiktok({method:'POST',headers:{origin:'https://bad.example','content-type':'application/json'},
    body:{action:'begin',deviceId:randomUUID(),deviceToken:'a'.repeat(64)}},r);
 assert.equal(r.statusCode,403);
 const bad=makeRes();
 await tiktok({method:'POST',headers:{'content-type':'application/json'},
    body:{action:'status',deviceId:'wrong',deviceToken:'not-a-token'}},bad);
 assert.equal(bad.statusCode,400);
});
test('invalid OAuth callback never reports connected',async()=>{
 runEnv(async()=>{}); // ensures environment restoration
 const res=makeRes();
 await callback({method:'GET',query:{code:'mock',state:'malformed'}},res);
 assert.notEqual(res.redirected,'https://primehub-social-ai-primehubmall.vercel.app/tiktok-result.html?status=connected');
});
