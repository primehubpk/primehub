import { NextResponse } from 'next/server';
import { authorizedWalletAdmin } from '@/lib/walletAdminSession';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { getSupabasePrimaryPayload } from '@/lib/dualWriteServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!authorizedWalletAdmin(request)) return NextResponse.json({ error: 'Secure admin session required.' }, { status: 401 });
  const userId = new URL(request.url).searchParams.get('userId') || '';
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(userId)) return NextResponse.json({ error: 'Invalid member UID.' }, { status: 400 });
  try {
    const db = getAdminDb();
    // Indexed by UID: read audit events for this member only, not every reseller on every admin dashboard load.
    const types = ['reseller_wallet_credits', 'reseller_wallet_spends', 'reseller_wallet_refunds', 'reseller_member_events'];
    const snapshots = await Promise.all(types.map(type => db.collection(type).where('userId', '==', userId).get()));
    const events = snapshots.flatMap((snapshot, index) => snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: `${types[index]}:${doc.id}`,
        source: types[index],
        action: String(data.action || data.type || ''),
        status: String(data.status || ''),
        amount: Number(data.amount || 0),
        purpose: String(data.purpose || ''),
        reason: String(data.reason || ''),
        date: data.createdAt?.toDate?.()?.toISOString() || data.refundedAt?.toDate?.()?.toISOString() || null,
      };
    }));
    let rewardHistory: any[] = [];
    try {
      const wallet = await getSupabasePrimaryPayload('user_rewards', userId);
      if (Array.isArray(wallet?.history)) rewardHistory = wallet.history;
      else throw new Error('Wallet unavailable in Supabase.');
    } catch {
      const wallet = await db.collection('user_rewards').doc(userId).get();
      rewardHistory = Array.isArray(wallet.data()?.history) ? wallet.data()?.history : [];
    }
    return NextResponse.json({ ok: true, events, rewardHistory }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Member audit history unavailable.' }, { status: 503 });
  }
}
