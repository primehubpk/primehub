import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';
import { getDualWriteMode, isSupabaseWriteConfigured } from '@/lib/dualWriteServer';

export const runtime = 'nodejs';

type Prize = { id: string; name: string; type: string; points?: number; probability?: number; active?: boolean; stock?: number; voucherCode?: string; imageUrl?: string };
type RewardHistoryEntry = { id: string; action: 'spin'; prizeId: string; name: string; type: string; status: 'pending' | 'claimed'; createdAt: string; claimedAt?: string; source: 'guest' };
type GuestWallet = { lastSpin?: string; pendingPrize?: Prize | null; pendingPrizeToken?: string; claimedAt?: string; history?: RewardHistoryEntry[] };
type UserWallet = { points?: number; streak?: number; lastCheckIn?: string; lastSpin?: string; coupons?: string[]; freeDeliveryCredits?: number; history?: RewardHistoryEntry[] };

function dayKey() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date()); }
function validGuestId(value: unknown) { const id = String(value || '').trim(); return /^g_[a-zA-Z0-9]{12,80}$/.test(id) ? id : ''; }
function cfg() { return { url: String(process.env.SUPABASE_URL || '').replace(/\/+$/, ''), key: String(process.env.SUPABASE_SERVICE_ROLE_KEY || '') }; }
async function sb(path: string, init: RequestInit = {}) { const { url, key } = cfg(); if (!url || !key) throw new Error('Supabase is not configured.'); const response = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(init.headers || {}) }, cache: 'no-store' }); if (!response.ok) throw new Error(`Supabase ${response.status}: ${await response.text()}`); return response; }
function choosePrize(prizes: Prize[]) { const active = prizes.filter(p => p.active !== false && Number(p.probability) > 0 && Number(p.stock ?? 1) > 0); const total = active.reduce((sum, p) => sum + Number(p.probability || 0), 0); if (!active.length || total <= 0) return null; let cursor = Math.random() * total; for (const prize of active) { cursor -= Number(prize.probability || 0); if (cursor <= 0) return prize; } return active[active.length - 1]; }
async function rewardSettings() { if (getDualWriteMode() === 'supabase-primary' && isSupabaseWriteConfigured()) { try { const r = await sb('settings?id=eq.rewards&select=payload&limit=1'); const rows = await r.json(); const data = rows?.[0]?.payload || {}; if (Array.isArray(data.spinWheelSlots) && data.spinWheelSlots.length) return data; } catch {} } const snap = await getAdminDb().collection('settings').doc('rewards').get(); return snap.data() || {}; }
async function readGuest(id: string): Promise<GuestWallet> { if (getDualWriteMode() === 'supabase-primary' && isSupabaseWriteConfigured()) { try { const r = await sb(`user_rewards?id=eq.${encodeURIComponent(`guest:${id}`)}&select=payload&limit=1`); const rows = await r.json(); return rows?.[0]?.payload || {}; } catch {} } const snap = await getAdminDb().collection('user_rewards').doc(`guest_${id}`).get(); return (snap.data() || {}) as GuestWallet; }
async function writeGuest(id: string, wallet: GuestWallet) { if (getDualWriteMode() === 'supabase-primary' && isSupabaseWriteConfigured()) { await sb('user_rewards?on_conflict=id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ id: `guest:${id}`, user_id: null, payload: wallet, authoritative_source: 'supabase', mirror_status: 'pending', updated_at: new Date().toISOString() }) }); try { await getAdminDb().collection('user_rewards').doc(`guest_${id}`).set({ ...wallet, updatedAt: FieldValue.serverTimestamp() }, { merge: true }); } catch {} return; } await getAdminDb().collection('user_rewards').doc(`guest_${id}`).set({ ...wallet, updatedAt: FieldValue.serverTimestamp() }, { merge: true }); }
async function readUser(uid: string): Promise<UserWallet> { if (getDualWriteMode() === 'supabase-primary' && isSupabaseWriteConfigured()) { const r = await sb(`user_rewards?id=eq.${encodeURIComponent(uid)}&select=payload&limit=1`); const rows = await r.json(); return rows?.[0]?.payload || {}; } const snap = await getAdminDb().collection('user_rewards').doc(uid).get(); return (snap.data() || {}) as UserWallet; }
async function writeUser(uid: string, wallet: UserWallet) { if (getDualWriteMode() === 'supabase-primary' && isSupabaseWriteConfigured()) { await sb('user_rewards?on_conflict=id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ id: uid, user_id: uid, payload: wallet, authoritative_source: 'supabase', mirror_status: 'pending', updated_at: new Date().toISOString() }) }); } await getAdminDb().collection('user_rewards').doc(uid).set({ ...wallet, updatedAt: FieldValue.serverTimestamp() }, { merge: true }); }

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const guestId = validGuestId(body?.guestId);
    if (!guestId) return NextResponse.json({ error: 'Guest session is missing.' }, { status: 400 });
    if (body?.action === 'claim') {
      const header = request.headers.get('authorization') || '';
      if (!header.startsWith('Bearer ')) return NextResponse.json({ error: 'Login required to claim this reward.' }, { status: 401 });
      const user = await getAdminAuth().verifyIdToken(header.slice(7));
      const guest = await readGuest(guestId);
      const prize = guest.pendingPrize;
      if (!prize || !guest.pendingPrizeToken) return NextResponse.json({ error: 'No guest reward is waiting to be claimed.' }, { status: 400 });
      const current = { points: 0, coupons: [], freeDeliveryCredits: 0, history: [], ...(await readUser(user.uid)) } as UserWallet;
      const voucher = prize.type === 'coupon' ? (String(prize.voucherCode || '').trim() || `PH-${Math.random().toString(36).slice(2, 8).toUpperCase()}`) : '';
      const points = prize.type === 'points' ? Math.max(0, Number(prize.points || 0)) : 0;
      const now = new Date().toISOString();
      const claimedEntry: RewardHistoryEntry = { id: guest.pendingPrizeToken, action: 'spin', prizeId: prize.id, name: prize.name, type: prize.type, status: 'claimed', createdAt: guest.history?.find(entry => entry.id === guest.pendingPrizeToken)?.createdAt || now, claimedAt: now, source: 'guest' };
      const history = [...(current.history || []).filter(entry => entry.id !== claimedEntry.id), claimedEntry].slice(-100);
      const next = { ...current, points: Number(current.points || 0) + points, lastSpin: guest.lastSpin || current.lastSpin, coupons: voucher ? [...(current.coupons || []), voucher] : (current.coupons || []), freeDeliveryCredits: Number(current.freeDeliveryCredits || 0) + (prize.type === 'free-delivery' ? 1 : 0), history };
      await writeUser(user.uid, next);
      await writeGuest(guestId, { ...guest, pendingPrize: null, pendingPrizeToken: '', claimedAt: now, history: (guest.history || []).map(entry => entry.id === claimedEntry.id ? { ...entry, status: 'claimed', claimedAt: now } : entry) });
      return NextResponse.json({ ok: true, wallet: next, prize, voucher, claimed: true });
    }

    const today = dayKey();
    const current = await readGuest(guestId);
    if (current.lastSpin === today) return NextResponse.json({ error: 'Come back tomorrow for your next spin.' }, { status: 400 });
    const settings = await rewardSettings();
    const prize = choosePrize(Array.isArray(settings.spinWheelSlots) ? settings.spinWheelSlots : []);
    if (!prize) return NextResponse.json({ error: 'Spin prizes are being refreshed from Admin.' }, { status: 400 });
    const pendingPrizeToken = crypto.randomUUID();
    const now = new Date().toISOString();
    const historyEntry: RewardHistoryEntry = { id: pendingPrizeToken, action: 'spin', prizeId: prize.id, name: prize.name, type: prize.type, status: 'pending', createdAt: now, source: 'guest' };
    const next: GuestWallet = { ...current, lastSpin: today, pendingPrize: prize, pendingPrizeToken, history: [...(current.history || []), historyEntry].slice(-100) };
    await writeGuest(guestId, next);
    return NextResponse.json({ ok: true, guest: true, wallet: next, prize, loginRequiredToClaim: prize.type !== 'try-again' });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Guest reward action failed.' }, { status: 400 });
  }
}
