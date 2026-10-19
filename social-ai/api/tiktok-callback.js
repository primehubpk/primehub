import {oauthReady,parseState,exchangeAndVerify,pairedOwner,saveIdentity} from '../lib/tiktok-login.mjs';
const RESULTS=['connected','cancelled','failed','expired'];
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Referrer-Policy','no-referrer');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET')return res.status(405).end();
 const go=(status)=>{
   const value=RESULTS.includes(status)?status:'failed';
   return res.redirect(303,'https://primehub-social-ai-primehubmall.vercel.app/tiktok-result.html?status='+value);
 };
 const query=req.query||{};
 if(query.error)return go('cancelled');
 if(!oauthReady())return go('failed');
 let state;
 try{state=parseState(query.state)}
 catch{return go('expired')}
 try {
    if(!(await pairedOwner(state.id,state.token)))return go('failed');
    const profile=await exchangeAndVerify(query.code);
    const saved=await saveIdentity(state,profile);
    if(!saved?.saved)return go('failed');
    return go('connected');
 }catch{
    // Neither TikTok OAuth codes, bearer tokens nor device secrets are logged.
    return go('failed');
 }
}
