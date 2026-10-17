import {processRpcWithPairing,LIMIT} from '../lib/social-mcp.mjs';

// Streamable HTTP endpoint for the PUBLIC, zero-secret, read-only handoff plugin.
// Tools never access accounts, Android sessions or remote/private stored data.
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST') {
    res.setHeader('Allow','POST');
    return res.status(405).json({error:'Use MCP Streamable HTTP POST.'});
  }
  // Server-to-server clients omit Origin. Block untrusted browser requests.
  const origin=req.headers.origin;
  if(origin && origin!=='https://primehub-social-ai-primehubmall.vercel.app')
    return res.status(403).json({error:'Origin not allowed'});
  if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))
    return res.status(415).json({error:'Content-Type must be application/json.'});
  if(Number(req.headers['content-length']||0)>LIMIT)
    return res.status(413).json({error:'Request too large.'});
  let payload=req.body;
  if(typeof payload==='string'){
    if(payload.length>LIMIT)return res.status(413).json({error:'Request too large.'});
    try{payload=JSON.parse(payload)}catch{return res.status(400).json({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Invalid JSON'}})}
  }else if(!payload||typeof payload!=='object') {
    return res.status(400).json({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Invalid JSON'}});
  }
  if(JSON.stringify(payload).length>LIMIT)
    return res.status(413).json({error:'Request too large.'});
  if(payload.id===undefined){
    if(!payload||payload.jsonrpc!=='2.0'||typeof payload.method!=='string')
      return res.status(400).json({error:'Invalid notification'});
    return res.status(202).end();
  }
  const result=await processRpcWithPairing(payload,req.headers);
  return res.status(result.error && [-32020,-32600].includes(result.error.code)?400:200).json(result);
}
