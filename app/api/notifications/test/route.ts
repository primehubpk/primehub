import { NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'node:crypto';
import { getAdminDb, getAdminMessaging } from '@/lib/firebaseAdmin';
import { getPublicCatalogSnapshot, getStorefrontSettingsResultSnapshot } from '@/lib/publicCatalogServer';
import { pakistanDay, selectDailyPush, type PushSlot } from '@/lib/notifications/dailyPush';

export const runtime = 'nodejs';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLOTS: PushSlot[] = ['browse', 'big', 'live', 'arrivals'];
function authorized(request: Request) {
  const value = process.env.CRON_SECRET || '';
  const supplied = request.headers.get('authorization') || '';
  const actual = supplied.startsWith('Bearer ') ? supplied.slice(7) : '';
  if (!value || !actual) return false;
  const a = Buffer.from(actual), b = Buffer.from(value);
  return a.length === b.length && timingSafeEqual(a, b);
}
/**
 * No broadcasts. Only a specific registered PREVIEW install, only on Vercel preview,
 * with server-side cron secret, max one test for each of 4 slots per Pakistan day.
 */
export async function POST(request: Request) {
  if (process.env.VERCEL_ENV !== 'preview') return new NextResponse('Not found', { status: 404 });
  if (!authorized(request)) return new NextResponse('Unauthorized', { status: 401 });
  const raw = await request.text().catch(() => '');
  if (raw.length > 1000) return new NextResponse('Invalid request', { status: 400 });
  let input: { installationId?: string; slot?: string } = {};
  try { input = JSON.parse(raw); } catch { return new NextResponse('Invalid JSON', { status: 400 }); }
  const id = String(input.installationId || '');
  const slot = String(input.slot || '') as PushSlot;
  if (!UUID.test(id) || !SLOTS.includes(slot)) return new NextResponse('Invalid test input', { status: 400 });
  try {
    const now = new Date(), day = pakistanDay(now);
    const deviceDoc = getAdminDb().collection('push_installations').doc(id);
    const device = (await deviceDoc.get()).data();
    if (!device || device.environment !== 'preview' || device.allowed !== true || device.enabled !== true ||
        typeof device.token !== 'string' || !device.token) {
      return NextResponse.json({ sent: false, reason: 'Preview install is not opted in' }, { status: 409 });
    }
    const [catalog, stored] = await Promise.all([getPublicCatalogSnapshot(), getStorefrontSettingsResultSnapshot()]);
    const docs = stored.documents as Record<string, any>;
    const content = selectDailyPush(slot, now, id, device, catalog.products as Record<string, any>[],
      { ...(docs.general || {}), ...(docs.main || {}) });
    if (!content) return NextResponse.json({ sent: false, reason: 'No real eligible data in this slot' });
    const uid = String(device.userUid || '');
    if (slot === 'browse' && uid &&
        (await getAdminDb().collection('push_user_purchases').doc(uid + '_' + day).get()).exists) {
      return NextResponse.json({ sent: false, reason: 'Customer purchased' });
    }
    const key = createHash('sha256').update('preview:' + day + ':' + id + ':' + slot).digest('hex');
    const receipt = getAdminDb().collection('push_preview_test_receipts').doc(key);
    try { await receipt.create({ createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + 7 * 86400000), slot, day }); }
    catch { return NextResponse.json({ sent: false, reason: 'This test slot already used today' }, { status: 409 }); }
    const current = (await deviceDoc.get()).data();
    if (!current || current.environment !== 'preview' || current.allowed !== true ||
        current.enabled !== true || current.token !== device.token) {
      await receipt.delete().catch(() => undefined);
      return NextResponse.json({ sent: false, reason: 'Device opted out' }, { status: 409 });
    }
    try {
      await getAdminMessaging().send({
        token: device.token,
        data: { title: content.title, body: content.body, path: content.path,
          imageUrl: content.imageUrl || '', slot, day },
        android: { priority: 'high', ttl: 900000 },
      });
      return NextResponse.json({ sent: true, slot, hasImage: Boolean(content.imageUrl), destination: content.path });
    } catch (error) {
      await receipt.delete().catch(() => undefined);
      console.error('[push/test] preview FCM send failed', error instanceof Error ? error.message : 'unknown');
      return new NextResponse('Test send unavailable', { status: 503 });
    }
  } catch (error) {
    console.error('[push/test] unavailable', error instanceof Error ? error.message : 'unknown');
    return new NextResponse('Test unavailable', { status: 503 });
  }
}
