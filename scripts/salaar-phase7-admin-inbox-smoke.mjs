import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function text(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

const sessionCore = await text('lib/adminSession.ts');
assert.ok(sessionCore.includes("PRIMEHUB_ADMIN_SESSION_COOKIE = 'primehub_admin_session'"));
assert.ok(sessionCore.includes('verifySessionCookie'));
assert.ok(sessionCore.includes('httpOnly: true'));
assert.ok(sessionCore.includes("sameSite: 'lax'"));

const sessionRoute = await text('app/api/admin/session/route.ts');
assert.ok(sessionRoute.includes('verifyIdToken'));
assert.ok(sessionRoute.includes('createSessionCookie'));
assert.ok(sessionRoute.includes('response.cookies.set'));

const loginRoute = await text('app/api/admin/login/route.ts');
assert.ok(loginRoute.includes('process.env.ADMIN_PASSWORD'));
assert.equal(loginRoute.includes('NEXT_PUBLIC_ADMIN_PASSWORD'), false);
assert.equal(loginRoute.includes("|| 'junaid00'"), false);

const guard = await text('components/AdminAuthGuard.tsx');
assert.ok(guard.includes("signInWithCustomToken"));
assert.ok(guard.includes("/api/admin/login"));
assert.ok(guard.includes("/api/admin/session"));
assert.equal(guard.includes('document.cookie'), false);
assert.equal(guard.includes("localStorage.setItem('primehub_admin_auth'"), false);

const adminRoute = await text('app/api/admin/salaar/route.ts');
assert.ok(adminRoute.includes('verifyPrimeHubAdminRequest'));
assert.equal(adminRoute.includes('primehub_admin_auth=true'), false);
assert.ok(adminRoute.includes('imageUrls: sanitizeSalaarImageUrls(item.imageUrls)'));
assert.ok(adminRoute.includes('pendingImageUrls'));
assert.ok(adminRoute.includes('pendingSalesMemory'));
assert.ok(adminRoute.includes('pendingCartContext'));

const widget = await text('components/SalaarNative.tsx');
assert.ok(widget.includes('SalaarAdminInbox'));
assert.ok(widget.includes("/api/admin/session"));
assert.ok(widget.includes('adminAuthenticated'));
assert.ok(widget.includes('<Menu'));

const inbox = await text('components/salaar/SalaarAdminInbox.tsx');
assert.ok(inbox.includes("/api/admin/salaar-dual"));
assert.ok(inbox.includes("act('wait')"));
assert.ok(inbox.includes("act('continue')"));
assert.ok(inbox.includes('message.imageUrls'));
assert.ok(inbox.includes('8000'));
assert.ok(inbox.includes('5000'));

const vercel = await text('vercel.json');
assert.ok(vercel.includes('"feature/salaar-virtual-salesman"'));

console.log('Salaar Phase 7 admin inbox smoke: PASS');
