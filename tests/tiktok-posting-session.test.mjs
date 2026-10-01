import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

async function moduleFrom(path, prefix = '') {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const code = prefix + stripTypeScriptTypes(source.replace(/^import .*;\n/gm, ''));
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
}
const session = await moduleFrom('../lib/integrations/tiktokPostingSession.ts', "import {createHmac, randomBytes, timingSafeEqual} from 'node:crypto';\n");
const pin = 'test-pin';
const verifyAdmin = async request => (request.headers.get('cookie') || '').split(';').some(p => p.trim() === 'primehub_admin_auth=true');
globalThis.__tiktokTest = { verifyPrimeHubAdminRequest: verifyAdmin, getPostingPin: async () => pin, ...session };
const authSource = readFileSync(new URL('../lib/integrations/tiktokPostingAuth.ts', import.meta.url), 'utf8');
const authCode = stripTypeScriptTypes(authSource.replace(/^import .*;\n/gm, ''));
const auth = await import('data:text/javascript;base64,' + Buffer.from("import {createHash, createHmac, timingSafeEqual} from 'node:crypto';\n" +
  'const {verifyPrimeHubAdminRequest,getPostingPin,postingSessionFromRequest,validPostingSession}=globalThis.__tiktokTest;\n' + authCode).toString('base64'));

function request(token = '', admin = true, supplied) {
  return new Request('https://store.test/api/admin/tiktok/posting', { headers: {
    cookie: `${admin ? 'primehub_admin_auth=true;' : ''} ${session.POSTING_SESSION_COOKIE}=${token}`,
    ...(supplied === undefined ? {} : {'x-tiktok-posting-pin': supplied}),
  } });
}

test('verified posting session survives a request without the raw PIN', async () => {
  const token = session.createPostingSession(pin);
  assert.equal(await auth.postingAdmin(request(token)), true);
  assert.equal(await auth.postingAdmin(request()), false);
  assert.equal(await auth.postingAdmin(request(token, false)), false);
});

test('tampered, expired, future and PIN-rotated sessions are rejected', () => {
  const token = session.createPostingSession(pin, 1000);
  assert.equal(session.validPostingSession(token, pin, 1001), true);
  assert.equal(session.validPostingSession(token + 'x', pin, 1001), false);
  assert.equal(session.validPostingSession(token, 'new-pin', 1001), false);
  assert.equal(session.validPostingSession(token, pin, 999), false);
  assert.equal(session.validPostingSession(token, pin, 1000 + session.POSTING_SESSION_MAX_AGE), false);
  assert.equal(session.validPostingSession(token + '.extra', pin, 1001), false);
});

test('explicit wrong PIN is rejected even with an authorized cookie', async () => {
  assert.equal(await auth.postingAdmin(request('', true, pin)), true);
  assert.equal(await auth.postingAdmin(request(session.createPostingSession(pin), true, 'wrong-pin')), false);
  assert.equal(await auth.postingAdmin(request('', false, pin)), false);
});

test('OAuth state signatures cannot authorize a posting session', async () => {
  const state = await auth.signOAuthState('a'.repeat(32));
  assert.equal(session.validPostingSession(state, pin), false);
});

let storedPin = pin;
const writes = [];
const NextResponse = {json(body, init) {
  const response = Response.json(body, init);
  response.cookies = {set(name, value, options) {writes.push({name, value, options});}};
  return response;
}};
globalThis.__tiktokRouteTest = {
  NextResponse, verifyPrimeHubAdminRequest: verifyAdmin,
  getPostingPin: async () => storedPin,
  savePostingPin: async value => {storedPin = value.trim();},
  postingAdmin: auth.postingAdmin, sameOrigin: auth.sameOrigin, ...session,
};
const route = await moduleFrom('../app/api/admin/tiktok/posting/pin/route.ts',
  'const {NextResponse,verifyPrimeHubAdminRequest,getPostingPin,savePostingPin,postingAdmin,sameOrigin,createPostingSession,POSTING_SESSION_COOKIE,postingSessionCookieOptions}=globalThis.__tiktokRouteTest;\n');

function pinRequest(action, options = {}) {
  return new Request('https://store.test/api/admin/tiktok/posting/pin', {method:'POST', headers: {
    origin: options.origin || 'https://store.test', cookie: options.admin === false ? '' : 'primehub_admin_auth=true',
    'x-tiktok-posting-pin': options.supplied || '',
  }, body: JSON.stringify({action, pin: options.pin})});
}

test('save establishes an HttpOnly session and returns metadata without PIN', async () => {
  writes.length = 0;
  const response = await route.POST(pinRequest('save', {pin}));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {configured:true, authorized:true});
  assert.equal(writes.length, 1);
  assert.equal(writes[0].options.httpOnly, true);
  assert.equal(writes[0].options.sameSite, 'lax');
  assert.equal(session.validPostingSession(writes[0].value, pin), true);
  const restored = await route.GET(request(writes[0].value));
  assert.deepEqual(await restored.json(), {configured:true, authorized:true});
});

test('unlock requires correct PIN, admin and same origin', async () => {
  assert.equal((await route.POST(pinRequest('unlock', {supplied:pin}))).status, 200);
  assert.equal((await route.POST(pinRequest('unlock', {supplied:'wrong-pin'}))).status, 403);
  assert.equal((await route.POST(pinRequest('unlock', {supplied:pin, admin:false}))).status, 401);
  assert.equal((await route.POST(pinRequest('unlock', {supplied:pin, origin:'https://evil.test'}))).status, 403);
});

test('admin logout expires the posting session cookie', async () => {
  const logout = await moduleFrom('../app/api/admin/session/route.ts',
    'const {NextResponse,POSTING_SESSION_COOKIE,postingSessionCookieOptions}=globalThis.__tiktokRouteTest;\n');
  writes.length = 0;
  await logout.DELETE(pinRequest('unused'));
  assert.ok(writes.some(w => w.name === session.POSTING_SESSION_COOKIE && w.options.maxAge === 0 && w.value === ''));
});
