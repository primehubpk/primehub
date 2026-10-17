import {executePairing,availablePairOperations} from '../lib/pairing-backend.mjs';
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  if(req.method!=='POST')return res.status(405).json({error:'Use POST.'});
  const origin=req.headers.origin;
  if(origin && origin!=='https://primehub-social-ai-primehubmall.vercel.app')
    return res.status(403).json({error:'Origin not allowed'});
  if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))
    return res.status(415).json({error:'JSON required.'});
  if(Number(req.headers['content-length']||0)>1024)
    return res.status(413).json({error:'Request too long.'});
  const input=req.body;
  if(!input||typeof input!=='object'||Array.isArray(input))
    return res.status(400).json({error:'Valid JSON object required.'});
  const action=typeof input.action==='string'?input.action:'';
  // The browser/device calls begin/heartbeat/revoke, while owner can verify via MCP.
  if(!availablePairOperations.includes(action))return res.status(400).json({error:'Unknown operation.'});
  try{
    const result=await executePairing(action,input);
    return res.status(result.ok?200:403).json(result);
  }catch(e){
    return res.status(e.status||503).json({error:e.status===400?e.message:'Pairing service temporarily unavailable.'});
  }
}