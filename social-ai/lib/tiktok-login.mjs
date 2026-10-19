import {randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';
import {executePairing} from './pairing-backend.mjs';

export const ORIGIN='https://primehub-social-ai-primehubmall.vercel.app';
export const REDIRECT=ORIGIN+'/api/tiktok-callback';
const KEY='PH_SOCIAL_TIKTOK_CLIENT_KEY';
const SECRET='PH_SOCIAL_TIKTOK_CLIENT_SECRET';
const STATE='PH_SOCIAL_TIKTOK_STATE_KEY';
const PROOF='PH_SOCIAL_TIKTOK_SERVER_PROOF';
const MAX_AGE=10*60*1000;
const AAD=Buffer.from('primehub-social-tiktok-identity-v1');

export const oauthReady=()=>Boolean(process.env[KEY]&&process.env[SECRET]&&process.env[STATE]&&process.env[PROOF]);
function stateKey(){
 const secret=process.env[STATE]||'';
 const buf=Buffer.from(secret,'base64url');
 if(buf.length!==32)throw Error('TikTok state protection is not configured');
 return buf;
}
export function createState(deviceId,deviceToken,now=Date.now()) {
 if(!/^[0-9a-f-]{36}$/i.test(deviceId)|| !/^[a-f0-9]{64}$/.test(deviceToken))
   throw Error('Invalid paired Android device');
 const iv=randomBytes(12);
 const cipher=createCipheriv('aes-256-gcm',stateKey(),iv);
 cipher.setAAD(AAD);
 const plain=JSON.stringify({id:deviceId,token:deviceToken,time:now,nonce:randomBytes(12).toString('hex')});
 const ciphertext=Buffer.concat([cipher.update(plain,'utf8'),cipher.final()]);
 return Buffer.concat([iv,ciphertext,cipher.getAuthTag()]).toString('base64url');
}
export function parseState(state,now=Date.now()){
 if(typeof state!=='string'||state.length>1024||state.length<48||!/^[\w-]+$/.test(state))
   throw Error('Invalid state');
 const raw=Buffer.from(state,'base64url');
 if(raw.length<41||raw.length>720)throw Error('Invalid state length');
 const dec=createDecipheriv('aes-256-gcm',stateKey(),raw.subarray(0,12));
 dec.setAAD(AAD);dec.setAuthTag(raw.subarray(raw.length-16));
 const val=JSON.parse(Buffer.concat([dec.update(raw.subarray(12,-16)),dec.final()]).toString('utf8'));
 if(!Number.isSafeInteger(val.time)||val.time>now+60_000||now-val.time>MAX_AGE||
  !/^[0-9a-f-]{36}$/i.test(val.id)||!/^[a-f0-9]{64}$/.test(val.token))
   throw Error('Invalid or expired state');
 return val;
}
export function loginUrl(state){
 const url=new URL('https://www.tiktok.com/v2/auth/authorize/');
 url.searchParams.set('client_key',process.env[KEY]);
 url.searchParams.set('scope','user.info.basic');
 url.searchParams.set('response_type','code');
 url.searchParams.set('redirect_uri',REDIRECT);
 url.searchParams.set('state',state);
 url.searchParams.set('disable_auto_auth','1');
 return url.toString();
}
export async function pairedOwner(id,token){
 const result=await executePairing('heartbeat',{deviceId:id,deviceToken:token});
 return result.ok===true&&result.result?.authorized===true&&result.result?.paired===true;
}
async function rpc(name,params){
 const host=process.env.PH_SOCIAL_PAIR_SUPABASE_URL,key=process.env.PH_SOCIAL_PAIR_SUPABASE_ANON;
 if(!host||!key)throw Error('Backend not configured');
 const url=host+'/rest/v1/rpc/'+name;
 const response=await fetch(url,{method:'POST',headers:{
   'content-type':'application/json','apikey':key,'authorization':'Bearer '+key
 },body:JSON.stringify(params),signal:AbortSignal.timeout(9500)});
 if(!response.ok)throw Error('Profile storage rejected');
 return await response.json();
}
export async function getIdentity(id,token){
 return await rpc('ph_social_tiktok_owner_status',{p_device_id:id,p_device_token:token});
}
export async function unlinkIdentity(id,token){
 return await rpc('ph_social_tiktok_owner_disconnect',{p_device_id:id,p_device_token:token});
}
export async function saveIdentity(data,profile){
 const proof=process.env[PROOF];
 if(!proof||proof.length<40)throw Error('OAuth identity proof not configured');
 return await rpc('ph_social_tiktok_owner_save',{
   p_device_id:data.id,p_device_token:data.token,
   p_open_id:profile.open_id,p_display_name:profile.display_name,
   p_avatar_url:profile.avatar_url||'',p_server_proof:proof
 });
}
export async function exchangeAndVerify(code) {
 if(!oauthReady())throw Error('Official Login Kit is not configured');
 if(typeof code!=='string'||!code||code.length>2048)throw Error('Invalid authorization response');
 const body=new URLSearchParams({
   client_key:process.env[KEY],client_secret:process.env[SECRET],
   code,grant_type:'authorization_code',redirect_uri:REDIRECT
 });
 const response=await fetch('https://open.tiktokapis.com/v2/oauth/token/',{
   method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},
   body:body.toString(),signal:AbortSignal.timeout(10000)
 });
 if(!response.ok)throw Error('TikTok authorization was not successful');
 const token=await response.json();
 if(typeof token.access_token!=='string'||!token.access_token||!token.scope?.includes('user.info.basic'))
   throw Error('TikTok did not authorize basic identity scope');
 const info=await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url',{
    headers:{authorization:'Bearer '+token.access_token},signal:AbortSignal.timeout(10000)
 });
 if(!info.ok)throw Error('Could not verify TikTok account identity');
 const data=await info.json();
 if(data?.error?.code!=='ok'||typeof data?.data?.user?.open_id!=='string')
   throw Error('TikTok identity verification failed');
 const user=data.data.user;
 if(!user.display_name||user.open_id.length>180||user.display_name.length>150)
   throw Error('TikTok profile data invalid');
 return {open_id:user.open_id,display_name:user.display_name,
   avatar_url:typeof user.avatar_url==='string'?user.avatar_url.slice(0,1024):''};
}
