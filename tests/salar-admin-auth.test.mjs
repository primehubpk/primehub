import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

const source = (await readFile(new URL('../app/api/admin/salar/credentials/route.ts', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
const adminSessionSource = await readFile(new URL('../lib/adminSession.ts', import.meta.url), 'utf8');

let code = source.replace(/^import .*;\n/gm, '');
code = `const NextResponse = {json(value, init) { return Response.json(value, init); }};
const verifyPrimeHubAdminRequest=async request=>request.headers.get('cookie')==='primehub_admin_auth=true' ? {admin:true} : null;
const PROVIDER_ORDER=['cloudflare','groq','gemini','openrouter','custom'];
const credentialSummary=async()=>({groq:{keyCount:2}});
const saveProviderCredentials=async()=>{globalThis.__writes++};
` + stripTypeScriptTypes(code);

const route = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));

function req(body, cookie = '', origin = 'https://store.test') {
  return new Request('https://store.test/api/admin/salar/credentials', {
    method:'POST',
    headers:{origin,cookie},
    body:JSON.stringify(body),
  });
}

test('password admin session can read and save provider settings', async () => {
  globalThis.__writes = 0;
  assert.equal((await route.GET(req({}, 'primehub_admin_auth=true'))).status, 200);
  assert.equal((await route.POST(req({action:'save',provider:'groq',keys:['test-token']}, 'primehub_admin_auth=true'))).status, 200);
  assert.equal(globalThis.__writes, 1);
});

test('missing admin session is rejected', async () => {
  assert.equal((await route.GET(req({}))).status, 401);
  assert.equal((await route.POST(req({action:'save',provider:'groq'}))).status, 401);
});

test('cross-origin key writes are rejected', async () => {
  assert.equal((await route.POST(req({action:'save',provider:'groq'},'primehub_admin_auth=true','https://other.test'))).status,403);
});

test('Google verification action is no longer supported', async () => {
  assert.equal((await route.POST(req({action:'verify-admin',idToken:'test-token'}, 'primehub_admin_auth=true'))).status,400);
  assert.doesNotMatch(adminSessionSource, /Google|Firebase|VERCEL_GIT_COMMIT_REF|verifySessionCookie/);
  assert.match(adminSessionSource, /primehub_admin_auth/);
});

test('authorized key saves return metadata without secret values', async () => {
  const response=await route.POST(req({action:'save',provider:'groq',keys:['secret-not-returned']}, 'primehub_admin_auth=true'));
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{success:true,providers:{groq:{keyCount:2}}});
});
