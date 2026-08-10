'use client';

import React, { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { Sparkles, Trophy, Zap, Gift } from 'lucide-react';

interface Reward { points?: number; streak?: number; lastCheckIn?: string; lastSpin?: string; coupons?: string[]; }
const EMPTY_REWARD: Reward = { points: 0, streak: 0, coupons: [] };
const guestKey = 'phdeals-guest-rewards';

export default function RewardsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [reward, setReward] = useState<Reward>(EMPTY_REWARD);
  const [message, setMessage] = useState('');
  const day = () => new Date().toISOString().slice(0, 10);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => { setUser(u); setAuthReady(true); });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (user) return;
    try { const saved = localStorage.getItem(guestKey); if (saved) setReward({ ...EMPTY_REWARD, ...JSON.parse(saved) }); } catch { /* keep defaults */ }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'user_rewards', user.uid), (snap) => setReward({ ...EMPTY_REWARD, ...(snap.data() || {}) } as Reward));
    return () => unsub();
  }, [user]);

  const saveGuest = (next: Reward) => { setReward(next); try { localStorage.setItem(guestKey, JSON.stringify(next)); } catch { /* storage may be unavailable */ } };

  async function checkIn() {
    if (reward.lastCheckIn === day()) return;
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const streak = reward.lastCheckIn === yesterday ? Math.min(7, Number(reward.streak || 0) + 1) : 1;
    const next = { ...reward, points: Number(reward.points || 0) + 10, streak, lastCheckIn: day(), coupons: reward.coupons || [] };
    if (user) await setDoc(doc(db, 'user_rewards', user.uid), { ...next, updatedAt: serverTimestamp() }, { merge: true }); else saveGuest(next);
    setMessage(`Day ${streak} check-in complete: +10 points`);
  }

  async function spin() {
    if (reward.lastSpin === day()) return;
    const coupon = ['SAVE10', 'SAVE15', 'FREESHIP'][Math.floor(Math.random() * 3)];
    const next = { ...reward, points: Number(reward.points || 0) + 5, lastSpin: day(), coupons: [...(reward.coupons || []), coupon] };
    if (user) await setDoc(doc(db, 'user_rewards', user.uid), { ...next, updatedAt: serverTimestamp() }, { merge: true }); else saveGuest(next);
    setMessage(`You won ${coupon}. ${user ? 'It is saved to your account.' : 'It is saved on this device.'}`);
  }

  if (!authReady) return <main className="min-h-screen bg-[#F4F4F1]" aria-label="Rewards Hub" />;

  return (
    <main className="min-h-screen bg-[#F4F4F1] px-4 py-6 pb-28">
      <div className="mx-auto max-w-md space-y-4">
        <section className="rounded-[30px] bg-[#14140F] p-6 text-white shadow-md">
          <Sparkles className="h-6 w-6 text-[#FFB020]" />
          <h1 className="mt-3 text-3xl font-black">Rewards Hub</h1>
          <p className="mt-2 text-xs text-white/60">{user?.email || 'Guest rewards — no account required'}</p>
          <p className="mt-5 text-3xl font-black text-[#FFB020]">{reward.points || 0} points</p>
        </section>

        <section className="rounded-[30px] border bg-white p-5 shadow-sm">
          <Trophy className="h-6 w-6 text-[#E1352B]" />
          <h2 className="mt-2 text-xl font-black">7-Day Check-in</h2>
          <div className="mt-4 grid grid-cols-7 gap-1">{Array.from({ length: 7 }, (_, i) => <span key={i} className={`rounded-lg p-2 text-center text-[9px] font-black ${i < Number(reward.streak || 0) ? 'bg-[#0F6A5F] text-white' : 'bg-[#F4F4F1] text-gray-500'}`}>D{i + 1}</span>)}</div>
          <button disabled={reward.lastCheckIn === day()} onClick={checkIn} className="mt-4 w-full rounded-xl bg-[#14140F] py-3 text-xs font-black text-white disabled:opacity-50">{reward.lastCheckIn === day() ? 'Checked in today' : 'Check in +10 points'}</button>
        </section>

        <section className="rounded-[30px] border bg-white p-5 shadow-sm">
          <Zap className="h-6 w-6 text-[#FFB020]" />
          <h2 className="mt-2 text-xl font-black">Spin & Win</h2>
          <button disabled={reward.lastSpin === day()} onClick={spin} className="mt-4 w-full rounded-xl bg-[#E1352B] py-4 text-xs font-black text-white disabled:opacity-50">{reward.lastSpin === day() ? 'Come back tomorrow' : 'Spin for a coupon'}</button>
        </section>

        <section className="rounded-[30px] border bg-white p-5 shadow-sm">
          <Gift className="h-6 w-6 text-[#0F6A5F]" />
          <h2 className="mt-2 text-lg font-black">Saved Coupons</h2>
          <p className="mt-2 text-xs font-mono text-black/60">{reward.coupons?.length ? reward.coupons.join(' · ') : 'No coupons yet.'}</p>
        </section>

        {message && <p className="rounded-xl bg-[#0F6A5F] p-3 text-center text-xs font-black text-white">{message}</p>}
      </div>
    </main>
  );
}
