import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';
import { reviewResellerTaskClaim, reviewResellerWithdrawal } from '@/lib/resellerServer';
import { mirrorResellerDocAndProfile, mirrorResellerFirestoreDoc } from '@/lib/resellerDualMirror';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADMIN_COOKIE = 'primehub_admin_auth';

type Row = Record<string, any>;

function isAuthorized(request: Request) {
  const cookie = request.headers.get('cookie') || '';
  return cookie.split(';').some((part) => part.trim() === `${ADMIN_COOKIE}=true`);
}

function supabaseConfig() {
  return {
    url: String(process.env.SUPABASE_URL || '').replace(/\/+$/, ''),
    key: String(process.env.SUPABASE_SERVICE_ROLE_KEY || ''),
  };
}

async function supabaseRows(table: string, select: string, order = 'created_at.desc', limit = 500) {
  const { url, key } = supabaseConfig();
  if (!url || !key) throw new Error('Supabase admin configuration is unavailable.');
  const params = new URLSearchParams();
  params.set('select', select);
  if (order) params.set('order', order);
  params.set('limit', String(limit));
  const response = await fetch(`${url}/rest/v1/${table}?${params.toString()}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`${table} read failed (${response.status}).`);
  return await response.json() as Row[];
}

function payload(row: Row) {
  return row?.payload && typeof row.payload === 'object' ? row.payload : {};
}

function emailLabel(value: unknown) {
  const email = String(value || '').trim();
  const local = email.split('@')[0] || '';
  const cleaned = local.replace(/[._-]+/g, ' ').replace(/\d+$/g, '').trim();
  if (!cleaned) return '';
  return cleaned.split(/\s+/).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function mapProfile(row: Row) {
  const p = payload(row);
  return {
    ...p,
    id: String(row.user_id || p.userId || ''),
    userId: String(row.user_id || p.userId || ''),
    email: row.email ?? p.email ?? '',
    displayName: p.displayName ?? '',
    status: row.status ?? p.status ?? 'active',
    tierId: row.tier_id ?? p.tierId ?? 'starter',
    monthlyOrders: Number(row.monthly_orders ?? p.monthlyOrders ?? 0),
    walletAvailable: Number(row.wallet_available ?? p.walletAvailable ?? 0),
    walletPending: Number(row.wallet_pending ?? p.walletPending ?? 0),
    pointsBalance: Number(row.points_balance ?? p.pointsBalance ?? 0),
    createdAt: p.createdAt ?? row.created_at ?? null,
    updatedAt: p.updatedAt ?? row.updated_at ?? null,
  };
}

function mapUserReward(row: Row) {
  const p = payload(row);
  return {
    id: String(row.id || ''),
    userId: String(row.user_id || row.id || ''),
    points: Number(p.points || 0),
    streak: Number(p.streak || 0),
    lastCheckIn: p.lastCheckIn || null,
    lastSpin: p.lastSpin || null,
    history: Array.isArray(p.history) ? p.history : [],
    vouchers: Array.isArray(p.vouchers) ? p.vouchers : [],
    freeProducts: Array.isArray(p.freeProducts) ? p.freeProducts : [],
    freeDeliveryCredits: Number(p.freeDeliveryCredits || 0),
  };
}

function mapWithdrawal(row: Row) {
  const p = payload(row);
  return {
    ...p,
    id: String(row.id || p.id || ''),
    userId: String(row.user_id || p.userId || ''),
    amount: Number(row.amount ?? p.amount ?? 0),
    method: row.method ?? p.method ?? '',
    status: row.status ?? p.status ?? 'pending',
    createdAt: p.createdAt ?? row.created_at ?? null,
  };
}

function mapReward(row: Row) {
  const p = payload(row);
  return {
    ...p,
    id: String(row.id || p.id || ''),
    userId: String(row.user_id || p.userId || ''),
    orderId: row.order_id ?? p.orderId ?? '',
    rewardAmount: Number(row.reward_amount ?? p.rewardAmount ?? 0),
    status: row.status ?? p.status ?? 'pending',
    availableAt: row.available_at ?? p.availableAt ?? null,
    createdAt: p.createdAt ?? row.created_at ?? null,
  };
}

function mapClaim(row: Row) {
  const p = payload(row);
  return {
    ...p,
    id: String(row.id || p.id || ''),
    userId: String(row.user_id || p.userId || ''),
    taskId: row.task_id ?? p.taskId ?? '',
    proof: row.proof ?? p.proof ?? '',
    status: row.status ?? p.status ?? 'pending',
    points: Number(row.points ?? p.points ?? 0),
    createdAt: p.createdAt ?? row.created_at ?? null,
  };
}

function mapPoint(row: Row) {
  const p = payload(row);
  return {
    ...p,
    id: String(row.id || p.id || ''),
    userId: String(row.user_id || p.userId || ''),
    claimId: row.claim_id ?? p.claimId ?? '',
    taskId: row.task_id ?? p.taskId ?? '',
    points: Number(row.points ?? p.points ?? 0),
    reason: row.reason ?? p.reason ?? '',
    status: row.status ?? p.status ?? 'approved',
    createdAt: p.createdAt ?? row.created_at ?? null,
  };
}

function mapTaskEvent(row: Row) {
  const p = payload(row);
  return {
    ...p,
    id: String(row.id || p.id || ''),
    userId: String(row.user_id || p.userId || ''),
    taskId: row.task_id ?? p.taskId ?? '',
    event: row.event ?? p.event ?? 'opened',
    createdAt: p.createdAt ?? row.created_at ?? null,
  };
}

function mapOrder(row: Row) {
  const p = payload(row);
  return {
    ...p,
    id: String(row.id || p.id || ''),
    resellerUserId: String(row.reseller_user_id || p.resellerUserId || ''),
    status: row.status ?? p.status ?? 'pending',
    total: Number(row.total ?? p.total ?? 0),
    customer: row.customer && typeof row.customer === 'object' ? row.customer : (p.customer || {}),
    createdAt: p.createdAt ?? row.created_at ?? null,
  };
}

async function enrichProfiles(profiles: Row[], userRewards: Row[]) {
  const rewardByUser = new Map(userRewards.map((reward) => [String(reward.userId || reward.id || ''), reward]));
  const auth = getAdminAuth();

  return Promise.all(profiles.map(async (profile) => {
    const userId = String(profile.id || profile.userId || '');
    const reward = rewardByUser.get(userId) || {};
    const taskPoints = Number(profile.pointsBalance || 0);
    const loyaltyPoints = Number(reward.points || 0);
    let authName = '';
    let authEmail = '';

    if (userId) {
      try {
        const user = await auth.getUser(userId);
        authName = String(user.displayName || '').trim();
        authEmail = String(user.email || '').trim();
      } catch {
        // Admin member list should still render even if Firebase Auth identity lookup is unavailable.
      }
    }

    const email = String(profile.email || authEmail || '').trim();
    const displayName = String(profile.displayName || authName || emailLabel(email) || '').trim();

    return {
      ...profile,
      email,
      displayName,
      taskPoints,
      loyaltyPoints,
      pointsBalance: taskPoints + loyaltyPoints,
      rewardStreak: Number(reward.streak || 0),
      rewardLastCheckIn: reward.lastCheckIn || null,
      rewardLastSpin: reward.lastSpin || null,
      rewardHistory: Array.isArray(reward.history) ? reward.history : [],
      rewardVouchers: Array.isArray(reward.vouchers) ? reward.vouchers : [],
      rewardFreeProducts: Array.isArray(reward.freeProducts) ? reward.freeProducts : [],
      rewardFreeDeliveryCredits: Number(reward.freeDeliveryCredits || 0),
    };
  }));
}

async function readFromSupabase() {
  const [profileRows, userRewardRows, withdrawalRows, rewardRows, claimRows, pointRows, eventRows, orderRows] = await Promise.all([
    supabaseRows('reseller_profiles', 'user_id,email,status,tier_id,monthly_orders,wallet_available,wallet_pending,points_balance,payload,created_at,updated_at', 'created_at.desc', 300),
    supabaseRows('user_rewards', 'id,user_id,payload,created_at,updated_at', 'updated_at.desc', 500),
    supabaseRows('reseller_withdrawals', 'id,user_id,amount,method,status,payload,created_at,updated_at', 'created_at.desc', 300),
    supabaseRows('reseller_reward_ledger', 'id,user_id,order_id,reward_amount,status,available_at,payload,created_at,updated_at', 'created_at.desc', 700),
    supabaseRows('reseller_task_claims', 'id,user_id,task_id,proof,status,points,payload,created_at,updated_at', 'created_at.desc', 500),
    supabaseRows('reseller_point_ledger', 'id,user_id,claim_id,task_id,points,reason,status,payload,created_at,updated_at', 'created_at.desc', 700),
    supabaseRows('reseller_task_events', 'id,user_id,task_id,event,payload,created_at,updated_at', 'created_at.desc', 700),
    supabaseRows('orders', 'id,reseller_user_id,status,total,customer,payload,created_at,updated_at', 'created_at.desc', 700),
  ]);

  const userRewards = userRewardRows.filter((row) => row.user_id).map(mapUserReward);
  const profiles = await enrichProfiles(profileRows.map(mapProfile), userRewards);

  return {
    profiles,
    userRewards,
    withdrawals: withdrawalRows.map(mapWithdrawal),
    ledger: rewardRows.map(mapReward),
    claims: claimRows.map(mapClaim),
    pointHistory: pointRows.map(mapPoint),
    taskEvents: eventRows.map(mapTaskEvent),
    orders: orderRows.map(mapOrder).filter((order) => order.resellerUserId),
    source: 'supabase',
  };
}

async function readFromFirebase() {
  const db = getAdminDb();
  const [profilesSnap, userRewardsSnap, withdrawalsSnap, ledgerSnap, claimsSnap, pointsSnap, eventsSnap, ordersSnap] = await Promise.all([
    db.collection('reseller_profiles').orderBy('createdAt', 'desc').limit(200).get(),
    db.collection('user_rewards').limit(500).get(),
    db.collection('reseller_withdrawals').orderBy('createdAt', 'desc').limit(200).get(),
    db.collection('reseller_reward_ledger').orderBy('createdAt', 'desc').limit(500).get(),
    db.collection('reseller_task_claims').orderBy('createdAt', 'desc').limit(300).get(),
    db.collection('reseller_point_ledger').orderBy('createdAt', 'desc').limit(500).get(),
    db.collection('reseller_task_events').orderBy('createdAt', 'desc').limit(500).get(),
    db.collection('orders').where('resellerUserId', '!=', '').limit(500).get(),
  ]);
  const rows = (snap: FirebaseFirestore.QuerySnapshot) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const userRewards = rows(userRewardsSnap).filter((row: any) => !String(row.id || '').startsWith('guest_')).map((row: any) => ({
    id: String(row.id || ''),
    userId: String(row.userId || row.id || ''),
    points: Number(row.points || 0),
    streak: Number(row.streak || 0),
    lastCheckIn: row.lastCheckIn || null,
    lastSpin: row.lastSpin || null,
    history: Array.isArray(row.history) ? row.history : [],
    vouchers: Array.isArray(row.vouchers) ? row.vouchers : [],
    freeProducts: Array.isArray(row.freeProducts) ? row.freeProducts : [],
    freeDeliveryCredits: Number(row.freeDeliveryCredits || 0),
  }));
  const profiles = await enrichProfiles(rows(profilesSnap), userRewards);
  return {
    profiles,
    userRewards,
    withdrawals: rows(withdrawalsSnap),
    ledger: rows(ledgerSnap),
    claims: rows(claimsSnap),
    pointHistory: rows(pointsSnap),
    taskEvents: rows(eventsSnap),
    orders: rows(ordersSnap),
    source: 'firebase',
  };
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  let data: Awaited<ReturnType<typeof readFromSupabase>> | Awaited<ReturnType<typeof readFromFirebase>>;
  let warning = '';
  try {
    data = await readFromSupabase();
  } catch (supabaseError) {
    try {
      data = await readFromFirebase();
      warning = supabaseError instanceof Error ? `Supabase unavailable; showing Firebase fallback. ${supabaseError.message}` : 'Supabase unavailable; showing Firebase fallback.';
    } catch (firebaseError) {
      const message = firebaseError instanceof Error ? firebaseError.message : String(firebaseError);
      return NextResponse.json({ error: message }, { status: 503 });
    }
  }

  const profiles = data.profiles || [];
  const withdrawals = data.withdrawals || [];
  const ledger = data.ledger || [];
  const claims = data.claims || [];
  const pointHistory = data.pointHistory || [];
  const taskEvents = data.taskEvents || [];
  const orders = data.orders || [];
  const activeProfiles = profiles.filter((p: any) => (p.status || 'active') === 'active');
  const totalPoints = activeProfiles.reduce((sum: number, p: any) => sum + Number(p.pointsBalance || 0), 0);

  const stats = {
    resellers: activeProfiles.length,
    pendingWithdrawals: withdrawals.filter((w: any) => w.status === 'pending').length,
    pendingTaskClaims: claims.filter((c: any) => c.status === 'pending').length,
    socialTaskOpens: taskEvents.length,
    walletLiability: profiles.reduce((sum: number, p: any) => sum + Number(p.walletAvailable || 0) + Number(p.walletPending || 0), 0),
    totalRewards: ledger.reduce((sum: number, r: any) => sum + Number(r.rewardAmount || 0), 0),
    totalPoints,
    trackedMonthlyOrders: activeProfiles.reduce((sum: number, p: any) => sum + Number(p.monthlyOrders || 0), 0),
  };

  return NextResponse.json({ ...data, stats, warning: warning || null });
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  try {
    const body = await request.json();
    const id = String(body?.id || '');
    const action = String(body?.action || '');
    const kind = String(body?.kind || 'withdrawal');
    if (!id) return NextResponse.json({ error: 'Missing record ID.' }, { status: 400 });

    if (kind === 'task') {
      if (!['approve', 'reject'].includes(action)) return NextResponse.json({ error: 'Invalid task action.' }, { status: 400 });
      await reviewResellerTaskClaim(id, action as 'approve' | 'reject', String(body?.adminNote || '').trim());
      await mirrorResellerDocAndProfile('reseller_task_claims', id);
      if (action === 'approve') await mirrorResellerFirestoreDoc('reseller_point_ledger', id);
    } else {
      if (!['approve', 'reject', 'paid'].includes(action)) return NextResponse.json({ error: 'Invalid withdrawal action.' }, { status: 400 });
      await reviewResellerWithdrawal(id, action as 'approve' | 'reject' | 'paid', String(body?.adminNote || '').trim());
      await mirrorResellerDocAndProfile('reseller_withdrawals', id);
    }

    return NextResponse.json({ ok: true, id, action });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to review record.' }, { status: 400 });
  }
}
