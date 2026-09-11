import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';
import { isSupabaseWriteConfigured } from '@/lib/dualWriteServer';

export const runtime = 'nodejs';

const SUPABASE_REWARD_TIMEOUT_MS = 3500;

type HistoryEntry = { id: string; action: 'spin' | 'checkin'; name: string; type: string; status: 'claimed' | 'completed'; createdAt: string; source: 'account' };
type Wallet = { points?: number; streak?: number; lastCheckIn?: string; lastSpin?: string; coupons?: string[]; freeDeliveryCredits?: number; history?: HistoryEntry[] };
type GuestWallet = { lastSpin?: string; pendingPrize?: Prize | null; pendingPrizeToken?: string };
type Prize = { id: string; name: string; type: string; points?: number; probability?: number; active?: boolean; stock?: number; productId?: string; voucherCode?: string; voucherAmount?: number; imageUrl?: string };

function dayKey() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date()); }
function validGuestId(value: unknown) { const id = String(value || '').trim(); return /^g_[a-zA-Z0-9]{12,80}$/.test(id) ? id : ''; }
function cfg() { const url = String(process.env.SUPABASE_URL || '').replace(/\/+$/, ''); const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || ''); return { url, key }; }
async function sb(path: string, init: RequestInit = {}) { const { url, key } = cfg(); if (!url || !key) throw new Error('Supabase is not configured.'); const r = await fetch(`${url}/rest/v1/${path}`, { ...init, signal: init.signal || AbortSignal.timeout(SUPABASE_REWARD_TIMEOUT_MS), headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(init.headers || {}) }, cache: 'no-store' }); if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`); return r; }
async function readSupabaseWallet(uid: string): Promise<Wallet> { const r = await sb(`user_rewards?id=eq.${encodeURIComponent(uid)}&select=payload&limit=1`); const rows = await r.json(); return (rows?.[0]?.payload || {}) as Wallet; }
async function readSupabaseGuest(guestId: string): Promise<GuestWallet> { if (!guestId) return {}; const r = await sb(`user_rewards?id=eq.${encodeURIComponent(`guest:${guestId}`)}&select=payload&limit=1`); const rows = await r.json(); return (rows?.[0]?.payload || {}) as GuestWallet; }
async function readSupabaseRewardSettings() { const r = await sb('settings?id=eq.rewards&select=payload&limit=1'); const rows = await r.json(); return rows?.[0]?.payload || {}; }
async function writeSupabaseWallet(uid: string, wallet: Wallet) { await sb('user_rewards?on_conflict=id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ id: uid, user_id: uid, payload: wallet, authoritative_source: 'supabase', mirror_status: 'pending', updated_at: new Date().toISOString() }) }); }
async function mirrorFirebaseWallet(uid: string, wallet: Wallet) { try { await getAdminDb().collection('user_rewards').doc(uid).set({ ...wallet, updatedAt: FieldValue.serverTimestamp() }, { merge: true }); } catch {} }
function choosePrize(prizes: Prize[]) { const active = prizes.filter(p => p.active !== false && Number(p.probability) > 0 && Number(p.stock ?? 1) > 0); const total = active.reduce((s, p) => s + Number(p.probability || 0), 0); if (!active.length || total <= 0) return null; let cursor = Math.random() * total; for (const p of active) { cursor -= Number(p.probability || 0); if (cursor <= 0) return p; } return active[active.length - 1]; }
function isLogicalRewardError(error: unknown) { const message = error instanceof Error ? error.message : String(error); return /Already checked in today|Come back tomorrow|Spin prizes are being refreshed/i.test(message); }
function appendHistory(current: Wallet, entry: HistoryEntry) { return [...(current.history || []), entry].slice(-100); }
function applySpin(current: Wallet, prize: Prize, today: string): Wallet {
  const points = prize.type === 'points' ? Math.max(0, Number(prize.points || 0)) : 0;
  const voucher = prize.type === 'coupon' ? (String(prize.voucherCode || '').trim() || `PH-${Math.random().toString(36).slice(2, 8).toUpperCase()}`) : '';
  const now = new Date().toISOString();
  const history: HistoryEntry = { id: crypto.randomUUID(), action: 'spin', name: prize.name, type: prize.type, status: 'claimed', createdAt: now, source: 'account' };
  return { ...current, points: Number(current.points || 0) + points, lastSpin: today, coupons: voucher ? [...(current.coupons || []), voucher] : (current.coupons || []), freeDeliveryCredits: Number(current.freeDeliveryCredits || 0) + (prize.type === 'free-delivery' ? 1 : 0), history: appendHistory(current, history) };
}
function applyCheckin(current: Wallet, settings: any, today: string): Wallet {
  if (current.lastCheckIn === today) throw new Error('Already checked in today.');
  const yesterday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date(Date.now() - 86400000));
  const streak = current.lastCheckIn === yesterday ? Math.min(7, Math.max(1, Number(current.streak || 0)) + 1) : 1;
  const rewards = Array.isArray(settings.checkInRewards) ? settings.checkInRewards : [10, 15, 20, 25, 30, 50, 100];
  const points = Math.max(0, Number(rewards[streak - 1] ?? 10));
  const history: HistoryEntry = { id: crypto.randomUUID(), action: 'checkin', name: `Day ${streak} check-in`, type: 'points', status: 'completed', createdAt: new Date().toISOString(), source: 'account' };
  return { ...current, points: Number(current.points || 0) + points, streak, lastCheckIn: today, history: appendHistory(current, history) };
}

async function firebaseAction(uid: string, action: string, guestId = '') {
  const db = getAdminDb(); const ref = db.collection('user_rewards').doc(uid); const today = dayKey();
  const settingsSnap = await db.collection('settings').doc('rewards').get(); const settings = settingsSnap.data() || {};
  const guestSnap = guestId ? await db.collection('user_rewards').doc(`guest_${guestId}`).get() : null;
  const guest = (guestSnap?.data() || {}) as GuestWallet;
  let prize: Prize | null = null; let result: Wallet = {};
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref); const current = { points: 0, streak: 0, coupons: [], freeDeliveryCredits: 0, history: [], ...(snap.data() || {}) } as Wallet;
    if (action === 'checkin') result = applyCheckin(current, settings, today);
    else {
      if (current.lastSpin === today || guest.lastSpin === today) throw new Error('Come back tomorrow for your next spin.');
      prize = choosePrize(Array.isArray(settings.spinWheelSlots) ? settings.spinWheelSlots : []);
      if (!prize) throw new Error('Spin prizes are being refreshed from Admin.');
      result = applySpin(current, prize, today);
    }
    tx.set(ref, { ...result, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
  return { wallet: result, prize };
}

export async function GET(request: Request) {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ')) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  try {
    const user = await getAdminAuth().verifyIdToken(header.slice(7));
    const url = new URL(request.url);
    const guestId = validGuestId(url.searchParams.get('guestId'));
    const today = dayKey();
    if (isSupabaseWriteConfigured()) {
      try {
        const [savedWallet, guest, settings] = await Promise.all([readSupabaseWallet(user.uid), readSupabaseGuest(guestId), readSupabaseRewardSettings()]);
        let wallet = { points: 0, streak: 0, coupons: [], freeDeliveryCredits: 0, history: [], ...savedWallet } as Wallet;
        if (guest.lastSpin === today && wallet.lastSpin !== today) {
          wallet = { ...wallet, lastSpin: today };
          await writeSupabaseWallet(user.uid, wallet);
          await mirrorFirebaseWallet(user.uid, wallet);
        }
        return NextResponse.json({ ok: true, source: 'supabase', wallet, settings, guest: { lastSpin: guest.lastSpin, hasPendingPrize: Boolean(guest.pendingPrize && guest.pendingPrizeToken) }, spinUsedToday: wallet.lastSpin === today || guest.lastSpin === today });
      } catch (error) {
        console.error('Supabase reward state read failed; using Firebase fallback:', error);
      }
    }
    const db = getAdminDb();
    const [walletSnap, settingsSnap, guestSnap] = await Promise.all([
      db.collection('user_rewards').doc(user.uid).get(),
      db.collection('settings').doc('rewards').get(),
      guestId ? db.collection('user_rewards').doc(`guest_${guestId}`).get() : Promise.resolve(null),
    ]);
    const wallet = { points: 0, streak: 0, ...(walletSnap.data() || {}) } as Wallet;
    const guest = (guestSnap?.data() || {}) as GuestWallet;
    return NextResponse.json({ ok: true, source: 'firebase-fallback', wallet, settings: settingsSnap.data() || {}, guest: { lastSpin: guest.lastSpin, hasPendingPrize: Boolean(guest.pendingPrize && guest.pendingPrizeToken) }, spinUsedToday: wallet.lastSpin === today || guest.lastSpin === today });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Reward state unavailable.' }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ')) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  try {
    const user = await getAdminAuth().verifyIdToken(header.slice(7));
    const body = await request.json();
    const action = body?.action === 'checkin' ? 'checkin' : 'spin';
    const guestId = validGuestId(body?.guestId);
    if (isSupabaseWriteConfigured()) {
      try {
        const today = dayKey();
        const [savedWallet, guest, settings] = await Promise.all([
          readSupabaseWallet(user.uid),
          readSupabaseGuest(guestId),
          readSupabaseRewardSettings(),
        ]);
        let current = { points: 0, streak: 0, coupons: [], freeDeliveryCredits: 0, history: [], ...savedWallet } as Wallet;
        if (guest.lastSpin === today && current.lastSpin !== today) {
          current = { ...current, lastSpin: today };
          await writeSupabaseWallet(user.uid, current);
          await mirrorFirebaseWallet(user.uid, current);
        }
        let wallet: Wallet; let prize: Prize | null = null;
        if (action === 'checkin') wallet = applyCheckin(current, settings, today);
        else {
          if (current.lastSpin === today || guest.lastSpin === today) throw new Error('Come back tomorrow for your next spin.');
          prize = choosePrize(Array.isArray(settings.spinWheelSlots) ? settings.spinWheelSlots : []);
          if (!prize) throw new Error('Spin prizes are being refreshed from Admin.');
          wallet = applySpin(current, prize, today);
        }
        await writeSupabaseWallet(user.uid, wallet);
        await mirrorFirebaseWallet(user.uid, wallet);
        return NextResponse.json({ ok: true, source: 'supabase', wallet, prize });
      } catch (error) {
        if (isLogicalRewardError(error)) throw error;
        console.error('Supabase reward action failed; using Firebase fallback:', error);
        const fallback = await firebaseAction(user.uid, action, guestId);
        return NextResponse.json({ ok: true, source: 'firebase-fallback', ...fallback });
      }
    }
    const fallback = await firebaseAction(user.uid, action, guestId);
    return NextResponse.json({ ok: true, source: 'firebase', ...fallback });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Reward action failed.' }, { status: 400 });
  }
}
