import assert from 'node:assert/strict';
const url = process.env.PH_MCP_URL || 'https://primehub-social-ai-primehubmall.vercel.app/api/mcp';
const M = '2026-07-28';
async function request(method,params={},headers={}) {
  const r=await fetch(url,{method:'POST',headers:{
    accept:'application/json,text/event-stream','content-type':'application/json',...headers},
    body:JSON.stringify({jsonrpc:'2.0',id:Math.floor(Math.random()*1_000_000),method,params}),
    signal:AbortSignal.timeout(12000)
  });
  const txt=await r.text();
  assert.match(r.headers.get('content-type')||'',/application\/json/);
  let data;try{data=JSON.parse(txt)}catch{throw new Error('Invalid JSON: '+txt.slice(0,400))}
  return {status:r.status,data};
}
const init=await request('initialize',{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'github-actions-mcp-smoke',version:'1'}});
assert.equal(init.status,200);
assert.equal(init.data.result.serverInfo.name,'primehub-social-ai-handoff');
const discover=await request('server/discover',{}, {'mcp-protocol-version':M,'mcp-method':'server/discover'});
assert.equal(discover.status,200);
assert.equal(discover.data.result.resultType,'complete');
const tools=await request('tools/list',{}, {'mcp-protocol-version':M,'mcp-method':'tools/list'});
assert.equal(tools.status,200);
assert.deepEqual(tools.data.result.tools.map(t=>t.name),['pair_owner_android_device','check_owner_android_connection','check_owner_tiktok_account','prepare_android_post','android_bridge_capabilities']);
const params={name:'prepare_android_post',arguments:{title:'Public MCP smoke test',caption:'PrimeHubMall test caption',platform:'TikTok'}};
const generated=await request('tools/call',params,{'mcp-protocol-version':M,'mcp-method':'tools/call','mcp-name':'prepare_android_post'});
assert.equal(generated.status,200);
assert.equal(generated.data.result.resultType,'complete');
assert.equal(generated.data.result.structuredContent.automatically_published,false);
const review=new URL(generated.data.result.structuredContent.preview_url);
assert.equal(review.origin,'https://primehub-social-ai-primehubmall.vercel.app');
assert.equal(review.pathname,'/handoff.html');
const invalid=await request('tools/call',{name:'read_android_cookies',arguments:{}});
assert.equal(invalid.data.error.code,-32602);
console.log('SUCCESS: production MCP legacy init, modern discovery, tool list, Android handoff and security smoke tests passed.');
