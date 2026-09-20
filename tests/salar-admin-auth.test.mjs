import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
const source = await readFile(new URL('../app/api/admin/salar/credentials/route.ts', import.meta.url), 'utf8');
let code = source.replace(/^import .*;\n/gm, '');
code = `const NextResponse = {json(value, init) { const r = Response.json(value, init); r.cookies = {set(){}}; return r; }};
const PRIMEHUB_ADMIN_EMAIL='admin@example.test', PRIMEHUB_ADMIN_UID='admin-uid', PRIMEHUB_ADMIN_SESSION_COOKIE='verified', PRIMEHUB_ADMIN_SESSION_MAX_AGE=86400;
const adminSessionCookieOptions=()=>({});
const verifyPrimeHubAdminRequest=async request=>request.headers.get('cookie')==='verified=test-session';
const PROVIDER_ORDER=['cloudflare','groq','gemini','openrouter'];
const credentialSummary=async()=>({groq:{keyCount:2}});
const saveProviderCredentials=async()=>{globalThis.__writes++};
const getAdminAuth=()=>({verifyIdToken:async()=>globalThis.__claims,createSessionCookie:async()=> 'signed-test-session'});
` + stripTypeScriptTypes(code);
const route = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
function req(body, cookie = '', origin = 'https://store.test') {
  return new Request('https://store.test/api/admin/salar/credentials', {method:'POST',headers:{origin,cookie},body:JSON.stringify(body)});
}
test('legacy admin cookie cannot read or change provider secrets', async () => {
  globalThis.__writes = 0;
  assert.equal((await route.GET(req({}, 'primehub_admin_auth=true'))).status, 401);
  assert.equal((await route.POST(req({action:'save',provider:'groq',keys:['test-token']}, 'primehub_admin_auth=true'))).status, 401);
  assert.equal(globalThis.__writes, 0);
});
test('cross-origin key writes are rejected even with a verified session', async () => {
  assert.equal((await route.POST(req({action:'save',provider:'groq'},'verified=test-session','https://other.test'))).status,403);
});
test('wrong identity and stale sign-ins cannot mint privileged sessions', async () => {
  globalThis.__claims={uid:'attacker',email:'admin@example.test',admin:true,email_verified:true,auth_time:Date.now()/1000};
  assert.equal((await route.POST(req({action:'verify-admin',idToken:'test-token'}))).status,403);
  globalThis.__claims={...globalThis.__claims,uid:'admin-uid',auth_time:Date.now()/1000-600};
  assert.equal((await route.POST(req({action:'verify-admin',idToken:'test-token'}))).status,403);
});
test('authorized key saves return metadata without keys', async () => {
  const response=await route.POST(req({action:'save',provider:'groq',keys:['secret-not-returned']}, 'verified=test-session'));
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{success:true,providers:{groq:{keyCount:2}}});
});
