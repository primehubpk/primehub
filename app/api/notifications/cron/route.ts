import { NextResponse } from 'next/server';
import { getAdminMessaging } from '@/lib/firebaseAdmin';
import { createHash, timingSafeEqual } from 'node:crypto';
import { FieldPath } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { getPublicCatalogSnapshot, getStorefrontSettingsResultSnapshot } from '@/lib/publicCatalogServer';
import { pakistanDay, selectDailyPush, type PushSlot } from '@/lib/notifications/dailyPush';

export const runtime = 'nodejs';
export const maxDuration = 60;
const PERIOD_SLOTS: Record<string, PushSlot[]> = { morning: ['browse', 'big'], evening: ['live', 'arrivals'] };
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const bearer = request.headers.get('authorization') || '';
  if (!secret || !bearer.startsWith('Bearer ')) return false;
  const left = Buffer.from(bearer.slice(7));
  const right = Buffer.from(secret);
  return left.length === right.length && timingSafeEqual(left, right);
}
function slotTime(period: string, date: Date) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', hour: '2-digit', hourCycle: 'h23' }).format(date));
  return hour === (period === 'morning' ? 11 : 22);
}
export async function GET(request: Request) {
  if (!authorized(request)) return new NextResponse('Unauthorized', { status: 401 });
  const url = new URL(request.url);
  const period = url.searchParams.get('period') || '';
  const slots = PERIOD_SLOTS[period];
  if (!slots) return new NextResponse('Invalid period', { status: 400 });
  const dryRun = url.searchParams.get('dryRun') === '1';
  if (!dryRun && (process.env.VERCEL_ENV !== 'production' || !slotTime(period, new Date()))) {
    return new NextResponse('Only the scheduled Pakistan production window may send', { status: 403 });
  }
  try {
    const [catalog, stored] = await Promise.all([getPublicCatalogSnapshot(), getStorefrontSettingsResultSnapshot()]);
    const products = catalog.products as Record<string, any>[];
    const settings = { ...(stored.documents.general || {}), ...(stored.documents.main || {}) };
    const installs = getAdminDb().collection('push_installations');
    const logs = getAdminDb().collection('push_delivery_log');
    const now = new Date(), day = pakistanDay(now);
    const results = { scanned: 0, candidates: 0, sent: 0, skipped: 0, failed: 0, dryRun, samples: [] as any[] };
    let last: FirebaseFirestore.QueryDocumentSnapshot | undefined;
    // Small bounded batches; never send an uncontrolled blast.
    for (let page = 0; page < 20; page++) {
      let query = installs.where('enabled', '==', true).orderBy(FieldPath.documentId()).limit(100);
      if (last) query = query.startAfter(last);
      const batch = await query.get();
      if (batch.empty) break;
      last = batch.docs[batch.docs.length - 1];
      for (const snap of batch.docs) {
        const device = snap.data();
        results.scanned++;
        if (device.allowed !== true || typeof device.token !== 'string' || !device.token || device.enabled !== true) {
          results.skipped++; continue;
        }
        for (const slot of slots) {
          const content = selectDailyPush(slot, now, snap.id, device, products, settings);
          if (!content) { results.skipped++; continue; }
          results.candidates++;
          if (dryRun) {
            if (results.samples.length < 8) results.samples.push({ slot, title: content.title, body: content.body, path: content.path, imageUrl: content.imageUrl || null });
            continue;
          }
          const userUid = String(device.userUid || '');
          if (slot === 'browse' && userUid && (await getAdminDb().collection('push_user_purchases').doc(userUid + '_' + day).get()).exists) {
            results.skipped++; continue;
          }
          const principal = userUid ? 'user:' + userUid : 'install:' + snap.id;
          const logId = createHash('sha256').update(principal + ':' + day + ':' + slot).digest('hex');
          const entry = logs.doc(logId);
          try {
            // Atomic reserve prevents cron retry / parallel invocation duplication.
            await entry.create({ installationId: snap.id, day, slot, createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + 90 * 86_400_000), status: 'reserved' });
          } catch { results.skipped++; continue; }
          try {
            // Check opt-out again immediately before send, to reduce races.
            const latest = (await snap.ref.get()).data();
            if (latest?.allowed !== true || latest?.enabled !== true || latest?.token !== device.token) {
              await entry.delete(); results.skipped++; continue;
            }
            await getAdminMessaging().send({
              token: device.token,
              data: {
                title: content.title, body: content.body, path: content.path,
                imageUrl: content.imageUrl || '', slot, day,
              },
              android: { priority: 'high', ttl: 1800000 },
            });
            await entry.update({ status: 'sent', sentAt: new Date().toISOString() });
            results.sent++;
          } catch (err: any) {
            results.failed++;
            // A transient error may be retried inside the same hour; permanent failures disable the token.
            if (/registration-token-not-registered|invalid-registration-token/i.test(String(err?.code || ''))) {
              await snap.ref.update({ enabled: false, updatedAt: new Date().toISOString() });
            } else await entry.delete().catch(() => undefined);
            console.error('[push/cron] send failed', slot, String(err?.code || err?.message || 'unknown'));
          }
        }
      }
      if (batch.size < 100) break;
    }
    return NextResponse.json(results, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[push/cron] failed', err instanceof Error ? err.message : 'unknown');
    return new NextResponse('Notification run failed', { status: 503 });
  }
}
