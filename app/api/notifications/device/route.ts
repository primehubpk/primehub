import { NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'node:crypto';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';
import { pakistanDay } from '@/lib/notifications/dailyPush';

export const runtime = 'nodejs';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SECRET = /^[a-zA-Z0-9_-]{32,128}$/;
const TOKEN = /^[\w:.-]{60,4096}$/;
const collection = 'push_installations';
function fingerprint(secret: string) { return createHash('sha256').update(secret).digest('hex'); }
function equal(a: string, b: string) { return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b)); }
function reject(code: number) { return NextResponse.json({ ok: false }, { status: code }); }
export async function POST(request: Request) {
  try {
    if (Number(request.headers.get('content-length') || 0) > 10000) return reject(413);
    const data = await request.json();
    const id = String(data?.installationId || '');
    const secret = String(data?.installationSecret || '');
    const action = String(data?.action || '');
    if (!UUID.test(id) || !SECRET.test(secret) || !['register', 'view', 'purchase', 'preferences', 'identity'].includes(action)) return reject(400);
    const doc = getAdminDb().collection(collection).doc(id);
    const previous = await doc.get();
    const hash = fingerprint(secret);
    if (previous.exists && !equal(String(previous.get('secretHash') || ''), hash)) return reject(403);
    const now = new Date().toISOString();
    if (action === 'register') {
      const token = String(data?.token || '');
      if (!TOKEN.test(token)) return reject(400);
      const allowed = data?.allowed === true;
      const enabled = data?.enabled === true;
      const payload = { token, allowed, enabled, environment: process.env.VERCEL_ENV === "preview" ? "preview" : "production", lastOpenedAt: now, updatedAt: now };
      if (!previous.exists) {
        try { await doc.create({ ...payload, secretHash: hash, createdAt: now }); }
        catch { return reject(409); } // Never overwrite another install on a racing create.
      } else await doc.update(payload);
      return NextResponse.json({ ok: true });
    }
    if (!previous.exists) return reject(404);
    if (action === 'identity') {
      const idToken = String(data?.idToken || '');
      if (idToken.length > 4096) return reject(400);
      let userUid = '';
      if (idToken) {
        try { userUid = (await getAdminAuth().verifyIdToken(idToken)).uid; } catch { return reject(401); }
      }
      await doc.update({ userUid, updatedAt: now });
    } else if (action === 'preferences') {
      await doc.update({ allowed: data?.allowed === true, enabled: data?.enabled === true, updatedAt: now });
    } else if (action === 'view') {
      const path = String(data?.path || '');
      if (!path.startsWith('/') || path.startsWith('//') || path.length > 300 || /[\n\r]/.test(path)) return reject(400);
      const match = /^\/product\/([^/?#]+)/.exec(path);
      const productId = match ? decodeURIComponent(match[1]).slice(0, 150) : '';
      await doc.update({ lastPath: path, ...(productId ? { lastProductId: productId } : {}), updatedAt: now });
    } else {
      const orderId = String(data?.orderId || '');
      if (!UUID.test(orderId)) return reject(400);
      // Only successful order ids qualify: check the primary order database and then mirror.
      let exists = false;
      const url = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
      const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
      if (url && key) {
        const r = await fetch(url + '/rest/v1/orders?id=eq.' + encodeURIComponent(orderId) + '&select=id&limit=1',
          { headers: { apikey: key, Authorization: 'Bearer ' + key }, cache: 'no-store', signal: AbortSignal.timeout(4500) });
        if (!r.ok) return reject(503);
        exists = (await r.json() as any[]).length > 0;
      } else exists = (await getAdminDb().collection('orders').doc(orderId).get()).exists;
      if (!exists) return reject(404);
      await doc.update({ lastOrderAt: now, updatedAt: now });
      const uid = String(previous.get('userUid') || '');
      if (uid) await getAdminDb().collection('push_user_purchases').doc(uid + '_' + pakistanDay(new Date())).set({ purchasedAt: now, expiresAt: new Date(Date.now() + 90 * 86_400_000) }, { merge: true });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[push/device] request failed', error instanceof Error ? error.message : 'unknown');
    return reject(503);
  }
}
