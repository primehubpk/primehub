import assert from 'node:assert/strict';
import { randomBytes,randomUUID } from 'node:crypto';

const url=process.env.PH_PAIR_URL||'https://primehub-social-ai-primehubmall.vercel.app/api/pair';
const base32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const freshCode=()=>Array.from({length:26},()=>base32[randomBytes(1)[0]&31]).join('');
const id=randomUUID();
const secret=randomBytes(32).toString('hex');
const code=freshCode();
const send=async(action,extra={})=>{
 const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},
  body:JSON.stringify({action,...extra}),signal:AbortSignal.timeout(12000)});
 const data=await response.json();
 if(response.status!==200||!data.ok)throw new Error(action+' request rejected (HTTP '+response.status+', error '+JSON.stringify(data).slice(0,140)+')');
 return data.result;
};
let created=false;
try {
 const reg=await send('begin',{deviceId:id,deviceToken:secret,code});
 assert.equal(reg.registered,true);
 created=true;
 const before=await send('status',{code});
 assert.equal(before.found,true);
 assert.equal(before.paired,false);
 const finish=await send('finish',{code});
 assert.equal(finish.paired,true);
 const beat=await send('heartbeat',{deviceId:id,deviceToken:secret});
 assert.equal(beat.paired,true);
 assert.equal(beat.authorized,true);
 const status=await send('status',{code});
 assert.equal(status.paired,true);
 assert.equal(status.online,true);
 console.log('SUCCESS: HTTPS Android owner pairing, claim, heartbeat, status, revoke flow passed.');
} finally {
 if(created) {
  const done=await send('revoke',{deviceId:id,deviceToken:secret});
  assert.equal(done.revoked,true);
  const afterward=await send('status',{code});
  assert.equal(afterward.found,false);
 }
}
