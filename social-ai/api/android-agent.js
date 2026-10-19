import {agentRpc,validateAgentDevice,validateAgentSession} from '../lib/agent-bridge.mjs';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Referrer-Policy','no-referrer');
 if(req.method!=='POST')return res.status(405).json({error:'POST only'});
 if(req.headers.origin && req.headers.origin!=='https://primehub-social-ai-primehubmall.vercel.app')
   return res.status(403).json({error:'Untrusted origin'});
 if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))
   return res.status(415).json({error:'JSON required'});
 if(Number(req.headers['content-length']||0)>13000)
   return res.status(413).json({error:'Request too large'});
 const data=req.body;
 if(!data||typeof data!=='object'||Array.isArray(data)||
   JSON.stringify(data).length>13000)
   return res.status(400).json({error:'Invalid request'});
 const {action}=data;
 if(!['start','stop','push','poll','complete'].includes(action))
   return res.status(400).json({error:'Unsupported owner-agent operation'});
 let identity;
 try{identity=validateAgentDevice(data)}catch{return res.status(400).json({error:'Invalid device identity'})}
 try{
   let out;
   if(action==='start'){
     const code=validateAgentSession(data.sessionCode);
     const seconds=Number(data.durationSeconds||900);
     if(!Number.isInteger(seconds)||seconds<120||seconds>1200)
       return res.status(400).json({error:'Session must last 2–20 minutes'});
     out=await agentRpc('start',{...identity,p_session_code:code,p_duration_seconds:seconds});
   }else if(action==='stop')out=await agentRpc('stop',identity);
   else if(action==='poll')out=await agentRpc('poll',identity);
   else if(action==='push'){
     if(!data.snapshot||typeof data.snapshot!=='object'||Array.isArray(data.snapshot))
       return res.status(400).json({error:'Invalid screen snapshot'});
     if(data.snapshot.package!=='com.zhiliaoapp.musically'||
       !Array.isArray(data.snapshot.elements)||data.snapshot.elements.length>100)
       return res.status(400).json({error:'Only TikTok visible UI is supported'});
     out=await agentRpc('push',{...identity,p_snapshot:data.snapshot});
   }else{
     if(!/^[a-f0-9-]{36}$/i.test(data.commandId||'')||
       typeof data.succeeded!=='boolean'||
       typeof data.message!=='string'||data.message.length>180)
       return res.status(400).json({error:'Invalid command receipt'});
     out=await agentRpc('complete',{
       ...identity,p_command_id:data.commandId,p_succeeded:data.succeeded,p_message:data.message
     });
   }
   return res.status(200).json(out);
 }catch{
   return res.status(503).json({error:'Agent bridge unavailable, please retry'});
 }
}