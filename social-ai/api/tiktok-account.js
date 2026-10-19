import {oauthReady,createState,loginUrl,getIdentity,unlinkIdentity,pairedOwner} from '../lib/tiktok-login.mjs';

export default async function handler(req,res) {
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Referrer-Policy','no-referrer');
 if(req.method==='GET')return res.status(200).json({
   loginKitReady:oauthReady(),
   service:'Official TikTok Login Kit (read-only profile identity)',
   permissions:['user.info.basic'],automaticPosting:false,
   configuredBy:'TikTok developer client key, secret and registered callback required'
 });
 if(req.method!=='POST')return res.status(405).json({error:'GET/POST only'});
 if(req.headers.origin&&req.headers.origin!=='https://primehub-social-ai-primehubmall.vercel.app')
   return res.status(403).json({error:'Origin not allowed'});
 if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))
   return res.status(415).json({error:'JSON required'});
 if(Number(req.headers['content-length']||0)>1600)
   return res.status(413).json({error:'Too large'});
 const data=req.body;
 if(!data||typeof data!=='object'||Array.isArray(data))
   return res.status(400).json({error:'Invalid body'});
 const {action,deviceId,deviceToken}=data;
 if(!['begin','status','disconnect'].includes(action) ||
  typeof deviceId!=='string'||!/^[a-f0-9-]{36}$/i.test(deviceId)||
  typeof deviceToken!=='string'||!/^[a-f0-9]{64}$/.test(deviceToken))
   return res.status(400).json({error:'Invalid owner device or request'});
 try{
   if(action==='begin') {
     if(!oauthReady())return res.status(409).json({error:'TikTok developer Login Kit has not been configured for PrimeHub Social AI yet.',setupRequired:true});
     if(!(await pairedOwner(deviceId,deviceToken)))
       return res.status(403).json({error:'Your Android device is not paired with ChatGPT.'});
     const authorizeUrl=loginUrl(createState(deviceId,deviceToken));
     return res.status(200).json({ok:true,authorizeUrl,scope:'user.info.basic',browser:'official_tiktok'});
   }
   if(action==='status'){
     const profile=await getIdentity(deviceId,deviceToken);
     if(!profile?.authorized)return res.status(403).json({error:'Pair this device first'});
     return res.status(200).json({ok:true,connected:profile.connected===true,
       displayName:profile.connected?profile.display_name:null,
       verifiedAt:profile.connected?profile.verified_at:null,
       canPublish:false,officialLoginReady:oauthReady()});
   }
   if(!(await pairedOwner(deviceId,deviceToken)))
     return res.status(403).json({error:'Pair this device first'});
   const cleared=await unlinkIdentity(deviceId,deviceToken);
   return res.status(200).json({ok:cleared?.removed===true,
     message:'Verified identity removed from PrimeHub Social AI. TikTok developer authorization can be revoked in your TikTok account settings.'});
 }catch{ return res.status(503).json({error:'TikTok account service temporarily unavailable'}); }
}
