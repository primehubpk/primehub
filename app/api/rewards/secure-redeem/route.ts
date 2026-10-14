import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';
import { isSupabaseWriteConfigured, recordMirrorFailure, supabasePrimaryUpsert } from '@/lib/dualWriteServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function mirrorPoints(uid: string, wallet: Record<string, any>) {
  if (!isSupabaseWriteConfigured()) return;
  const row = { id: uid, user_id: uid, payload: wallet, authoritative_source: 'firebase',
    mirror_status: 'synced', mirror_error: null, updated_at: new Date().toISOString() };
  try { await supabasePrimaryUpsert({ table: 'user_rewards', row }); }
  catch (error) {
    console.error('Reward redemption committed but Supabase mirror delayed:', error);
    try { await recordMirrorFailure('user_rewards', uid, 'upsert', row); } catch {}
  }
}

export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 });
  try {
    const { uid } = await getAdminAuth().verifyIdToken(authorization.slice(7), true);
    const body = await request.json();
    const action = String(body?.action || '');
    if (!['win', 'gift'].includes(action)) throw new Error('Unknown redemption action.');
    const db = getAdminDb();
    const walletRef = db.collection('user_rewards').doc(uid);
    let walletAfter: Record<string, any> | null = null;
    let redemptionId = '';
    if (action === 'win') {
      const winId = String(body?.winId || '');
      if (!/^[A-Za-z0-9_-]{16,160}$/.test(winId)) throw new Error('Invalid winner ID.');
      const winRef = db.collection('reward_wins').doc(winId);
      const redemptionRef = db.collection('reward_redemptions').doc('win_' + winId);
      const outcome = await db.runTransaction(async tx => {
        const [win, claimed] = await Promise.all([tx.get(winRef), tx.get(redemptionRef)]);
        if (claimed.exists) return { already: true };
        const data = win.data() || {};
        if (!win.exists || data.userId !== uid || data.status !== 'pending')
          throw new Error('This reward is unavailable or already redeemed.');
        tx.create(redemptionRef, {
          userId: uid, giftId: 'wheel:' + String(data.prizeId || ''), wheelWinId: winId,
          pointsCost: 0, rewardType: data.type, rewardName: data.name,
          productId: String(data.productId || ''), voucherCode: String(data.voucherCode || ''),
          voucherAmount: Number(data.voucherAmount || 0), status: 'pending',
          fulfillment: 'reward', freeDelivery: ['product','free-delivery'].includes(String(data.type || '')),
          deliveryFee: 0, createdAt: FieldValue.serverTimestamp(),
        });
        tx.update(winRef, { status: 'redeemed', redeemedAt: FieldValue.serverTimestamp() });
        return { already: false };
      });
      redemptionId = redemptionRef.id;
      return NextResponse.json({ ok: true, already: outcome.already, redemptionId }, {
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    const giftId = String(body?.giftId || '');
    const requestId = String(body?.requestId || '');
    if (!/^[A-Za-z0-9_-]{3,120}$/.test(giftId) ||
      !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(requestId)) throw new Error('Invalid gift or request ID.');
    const giftRef = db.collection('reward_gifts').doc(giftId);
    const redemptionRef = db.collection('reward_redemptions').doc(requestId);
    const outcome = await db.runTransaction(async tx => {
      const [gift, wallet, existing] = await Promise.all([tx.get(giftRef), tx.get(walletRef), tx.get(redemptionRef)]);
      if (existing.exists) {
        if (existing.data()?.userId !== uid || existing.data()?.giftId !== giftId)
          throw new Error('Redemption request ID is already used.');
        return { already: true, wallet: null };
      }
      const g = gift.data() || {};
      const cost = Number(g.pointsCost || 0);
      if (!gift.exists || g.active === false || !Number.isSafeInteger(cost) || cost <= 0 ||
        Number(g.stock ?? 1) < 1) throw new Error('This reward gift is unavailable.');
      const current = wallet.data() || {};
      const points = Number(current.points || 0);
      if (!Number.isSafeInteger(points) || points < cost) throw new Error('Insufficient reward points.');
      const updated = { ...current, points: points - cost, updatedAt: new Date().toISOString() };
      tx.set(walletRef, updated, { merge: true });
      tx.create(redemptionRef, {
        userId: uid, giftId, productId: String(g.productId || ''), pointsCost: cost,
        status: 'pending', fulfillment: 'reward', freeDelivery: true,
        deliveryFee: 0, rewardType: 'points-store', rewardName: String(g.title || 'Reward Gift'),
        createdAt: FieldValue.serverTimestamp(),
      });
      return { already: false, wallet: updated };
    });
    redemptionId = redemptionRef.id;
    walletAfter = outcome.wallet;
    if (walletAfter) await mirrorPoints(uid, walletAfter);
    return NextResponse.json({ ok: true, already: outcome.already, redemptionId }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Reward redemption failed.' }, { status: 400 });
  }
}
