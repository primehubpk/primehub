import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';
import { reviewResellerTaskClaim, reviewResellerWithdrawal } from '@/lib/resellerServer';

export const runtime = 'nodejs';
const ADMIN_UID = process.env.FIREBASE_ADMIN_UID || '';

async function requireAdmin(request: Request) {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ')) throw new Error('Unauthorized');
  const decoded = await getAdminAuth().verifyIdToken(header.slice(7));
  if (!ADMIN_UID || decoded.uid !== ADMIN_UID) throw new Error('Forbidden');
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const db = getAdminDb();
    const [profilesSnap, withdrawalsSnap, ledgerSnap, claimsSnap, pointsSnap, eventsSnap] = await Promise.all([
      db.collection('reseller_profiles').orderBy('createdAt', 'desc').limit(200).get(),
      db.collection('reseller_withdrawals').orderBy('createdAt', 'desc').limit(200).get(),
      db.collection('reseller_reward_ledger').orderBy('createdAt', 'desc').limit(500).get(),
      db.collection('reseller_task_claims').orderBy('createdAt', 'desc').limit(300).get(),
      db.collection('reseller_point_ledger').orderBy('createdAt', 'desc').limit(500).get(),
      db.collection('reseller_task_events').orderBy('createdAt', 'desc').limit(500).get(),
    ]);
    const profiles = profilesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const withdrawals = withdrawalsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const ledger = ledgerSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const claims = claimsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const pointHistory = pointsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const taskEvents = eventsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const stats = { resellers: profiles.filter((p: any) => p.status === 'active').length, pendingWithdrawals: withdrawals.filter((w: any) => w.status === 'pending').length, pendingTaskClaims: claims.filter((c: any) => c.status === 'pending').length, socialTaskOpens: taskEvents.length, walletLiability: profiles.reduce((sum: number, p: any) => sum + Number(p.walletAvailable || 0) + Number(p.walletPending || 0), 0), totalRewards: ledger.reduce((sum: number, r: any) => sum + Number(r.rewardAmount || 0), 0) };
    return NextResponse.json({ stats, profiles, withdrawals, ledger, claims, pointHistory, taskEvents });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load reseller management.' }, { status: 403 }); }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = await request.json();
    const id = String(body?.id || ''), action = String(body?.action || ''), kind = String(body?.kind || 'withdrawal');
    if (!id) return NextResponse.json({ error: 'Missing record ID.' }, { status: 400 });
    if (kind === 'task') {
      if (!['approve', 'reject'].includes(action)) return NextResponse.json({ error: 'Invalid task action.' }, { status: 400 });
      await reviewResellerTaskClaim(id, action as 'approve' | 'reject', String(body?.adminNote || '').trim());
    } else {
      if (!['approve', 'reject', 'paid'].includes(action)) return NextResponse.json({ error: 'Invalid withdrawal action.' }, { status: 400 });
      await reviewResellerWithdrawal(id, action as 'approve' | 'reject' | 'paid', String(body?.adminNote || '').trim());
    }
    return NextResponse.json({ ok: true, id, action });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to review record.' }, { status: 400 }); }
}