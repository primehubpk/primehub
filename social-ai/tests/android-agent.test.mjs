import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAgentDevice,validateAgentSession,ownerNavigate} from '../lib/agent-bridge.mjs';
import {processRpcWithPairing} from '../lib/social-mcp.mjs';
import handler from '../api/android-agent.js';
function fakeRes(){return {
 statusCode:200,headers:{},data:null,
 setHeader(k,v){this.headers[k]=v;return this},
 status(n){this.statusCode=n;return this},
 json(d){this.data=d;return this}
}}
const device={deviceId:'123e4567-e89b-42d3-a456-426614174000',deviceToken:'c'.repeat(64)};
test('device keys are structurally validated, not read from social app cookies',()=>{
 assert.deepEqual(validateAgentDevice(device),{p_device_id:device.deviceId,p_device_token:device.deviceToken});
 assert.throws(()=>validateAgentDevice({deviceId:'invalid',deviceToken:'password'}));
 assert.throws(()=>validateAgentSession('INVALID'));
});
test('owner MCP navigation requires time-limited code and fresh inspected revision',async()=>{
 await assert.rejects(ownerNavigate('bad-code','tap_label',1,'Create'),/session/i);
 await assert.rejects(ownerNavigate('A'.repeat(26),'generic_shell_command',0,''),/Invalid navigation request/);
 await assert.rejects(ownerNavigate('A'.repeat(26),'tap_label',-2,'Create'),/Invalid navigation request/);
 await assert.rejects(ownerNavigate('A'.repeat(26),'tap_label',2,''),/exact button label/);
});
test('MCP metadata allows only two time-gated tools, no generic phone shell',async()=>{
 const result=await processRpcWithPairing({jsonrpc:'2.0',id:7,method:'tools/list',params:{}});
 const names=result.result.tools.map(t=>t.name);
 assert.ok(names.includes('inspect_owner_android_screen'));
 assert.ok(names.includes('navigate_owner_android'));
 assert.ok(!names.includes('execute_android_shell'));
 assert.equal(result.result.tools.find(t=>t.name==='navigate_owner_android').annotations.readOnlyHint,false);
 const malformed=await processRpcWithPairing({jsonrpc:'2.0',id:8,method:'tools/call',
  params:{name:'navigate_owner_android',arguments:{owner_session_code:'BAD',operation:'tap_label',label:'Post',expected_revision:0}}});
 assert.equal(malformed.result.isError,true);
});
test('HTTP agent endpoint rejects untrusted origin, unsupported actions, unpaired device ID',async()=>{
 const req={method:'POST',headers:{'content-type':'application/json'},
   body:{action:'execute_shell',...device}};
 const a=fakeRes();await handler(req,a);assert.equal(a.statusCode,400);
 const b=fakeRes();await handler({...req,headers:{...req.headers,origin:'https://evil.example'}},b);
 assert.equal(b.statusCode,403);
 const c=fakeRes();await handler({...req,body:{action:'push',deviceId:'bad',deviceToken:'bad'}},c);
 assert.equal(c.statusCode,400);
 const d=fakeRes();await handler({method:'GET',headers:{},body:{}},d);
 assert.equal(d.statusCode,405);
});
test('owner session cannot start for zero duration',async()=>{
 const response=fakeRes();
 await handler({method:'POST',headers:{'content-type':'application/json'},
   body:{...device,action:'start',sessionCode:'A'.repeat(26),durationSeconds:5}},response);
 assert.equal(response.statusCode,400);
});
