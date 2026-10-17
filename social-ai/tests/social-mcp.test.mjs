import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHandoff,capabilities,processRpc,TOOL_DEFS,MCP_MODERN,MCP_LEGACY
} from '../lib/social-mcp.mjs';
import endpoint from '../api/mcp.js';

const request=(method,params={},headers={})=>
  processRpc({jsonrpc:'2.0',id:1,method,params},headers);
function fakeRes() {
  const res={statusCode:200,headers:{},data:undefined,done:false,
    setHeader(k,v){this.headers[k.toLowerCase()]=v;return this;},
    status(s){this.statusCode=s;return this;},
    json(v){this.data=v;this.done=true;return this;},
    end(){this.done=true;return this;}
  };
  return res;
}
const call=async(method,payload,extra={})=>{
  const req={method,headers:{'content-type':'application/json',...extra},body:payload};
  const res=fakeRes();
  await endpoint(req,res);
  return res;
};

test('2025 MCP initialize responds with correct server identity',()=>{
  const out=request('initialize',{protocolVersion:MCP_LEGACY,capabilities:{},clientInfo:{name:'smoke',version:'1'}});
  assert.equal(out.result.serverInfo.name,'primehub-social-ai-handoff');
  assert.equal(out.result.protocolVersion,MCP_LEGACY);
});
test('2026 MCP discover accepts routing headers and lists tools',()=>{
  const h={'mcp-protocol-version':MCP_MODERN,'mcp-method':'server/discover'};
  const discover=request('server/discover',{},h);
  assert.deepEqual(discover.result.supportedVersions,[MCP_MODERN,MCP_LEGACY]);
  assert.equal(discover.result.capabilities.tools.listChanged,false);
  const tools=request('tools/list',{}, {'mcp-protocol-version':MCP_MODERN,'mcp-method':'tools/list'});
  assert.equal(tools.result.tools.length,2);
  assert.deepEqual(tools.result.tools.map(x=>x.name),['prepare_android_post','android_bridge_capabilities']);
  assert.ok(tools.result.tools.every(x=>x.annotations.readOnlyHint));
});
test('MCP capability tool explicitly rejects unrestricted automation claims',()=>{
  const out=request('tools/call',{name:'android_bridge_capabilities',arguments:{}});
  assert.ok(out.result.structuredContent.cannot.some(x=>x.includes('Read a phone screen')));
  assert.ok(out.result.structuredContent.cannot.some(x=>x.includes('Publish')));
  assert.ok(capabilities().requires_owner_approval !== false);
});
test('generate tappable user-reviewed link to Android deep link',()=>{
  const data=buildHandoff({title:'Glass bangles',caption:'PrimeHubMall bangles\\n#PrimeHub',platform:'TikTok'});
  assert.equal(data.automatically_published,false);
  assert.equal(data.saved_to_device,false);
  assert.equal(data.requires_owner_approval,true);
  const url=new URL(data.preview_url);
  assert.equal(url.origin,'https://primehub-social-ai-primehubmall.vercel.app');
  assert.equal(url.pathname,'/handoff.html');
  assert.equal(url.searchParams.get('title'),'Glass bangles');
  assert.equal(url.searchParams.get('platform'),'TikTok');
  const result=request('tools/call',{name:'prepare_android_post',arguments:{title:'Glass bangles',caption:'Hello',platform:'Facebook'}});
  assert.match(result.result.content[0].text,/preview_url/);
});
test('do not trust arbitrary server destinations, secrets or unknown tools',()=>{
  for(const data of [
    {title:'x',caption:'hello',platform:'Missing'},
    {title:'x',caption:'hello',platform:'TikTok',url:'https://attacker.invalid'},
    {title:'x',caption:'',platform:'TikTok'},
    {title:'x',caption:'hello',platform:'TikTok',reminder_at_ms:Date.now()-100_000},
    {title:'x',caption:'x'.repeat(2401),platform:'TikTok'},
    {title:'x',caption:'é'.repeat(2300),platform:'TikTok'}
  ])assert.throws(()=>buildHandoff(data));
  assert.equal(request('tools/call',{name:'read_instagram_password',arguments:{}}).error.code,-32602);
});
test('modern tools/call requires correct routing method and tool name',()=>{
  const p={name:'prepare_android_post',arguments:{title:'Bangles',caption:'Hello',platform:'Instagram'}};
  const base={'mcp-protocol-version':MCP_MODERN,'mcp-method':'tools/call'};
  assert.equal(request('tools/call',p,base).error.code,-32020);
  const out=request('tools/call',p,{...base,'mcp-name':'prepare_android_post'});
  assert.equal(out.result.resultType,'complete');
  assert.equal(out.result.structuredContent.platform,'Instagram');
});
test('HTTP GET is correctly rejected: MCP POST only',async()=>{
  const res=await call('GET',undefined);
  assert.equal(res.statusCode,405);
  assert.equal(res.headers.allow,'POST');
});
test('HTTP POST accepts initialize and returns JSON-RPC response',async()=>{
  const res=await call('POST',{jsonrpc:'2.0',id:1,method:'initialize',params:{}});
  assert.equal(res.statusCode,200);
  assert.equal(res.data.result.serverInfo.name,'primehub-social-ai-handoff');
});
test('HTTP POST origin restrictions, JSON parse, method checks',async()=>{
  const payload={jsonrpc:'2.0',id:1,method:'tools/list',params:{}};
  const badOrigin=await call('POST',payload,{origin:'https://untrusted.example'});
  assert.equal(badOrigin.statusCode,403);
  const badType=await call('POST',payload,{'content-type':'text/plain'});
  assert.equal(badType.statusCode,415);
  const badJson=await call('POST','{ malformed');
  assert.equal(badJson.data.error.code,-32700);
  const notification=await call('POST',{jsonrpc:'2.0',method:'notifications/initialized'});
  assert.equal(notification.statusCode,202);
  const invalid=await call('POST',{jsonrpc:'1.0',id:1,method:'foo'});
  assert.equal(invalid.statusCode,400);
});
