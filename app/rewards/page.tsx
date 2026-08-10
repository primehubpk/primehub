'use client';

// ==================== CUSTOMER REWARDS HUB PAGE ====================
import React, { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { Sparkles, Trophy, Zap, Gift } from 'lucide-react';

interface Reward {
  points?: number;
  streak?: number;
  lastCheckIn?: string;
  lastSpin?: string;
  coupons?: string[];
}

export default function RewardsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [reward, setReward] = useState<Reward>({});
  const [message, setMessage] = useState<string>('');

  const day = () => new Date().toISOString().slice(0, 10);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'user_rewards', user.uid), (snap) => {
      setReward((snap.data() || {}) as Reward);
    });
    return () => unsub();
  }, [user]);

  if (!user) {
    return (
      <main className="min-h-screen bg-[#F4F4F1] p-8 text-center flex flex-col items-center justify-center">
        <h1 className="text-2xl font-black text-gray-900">PrimeHub Rewards</h1>
        <p className="mt-3 text-sm text-black/60 max-w-sm">
          Sign in with a Firebase customer account to save your points, streak, and coupons.
        </p>
      </main>
    );
  }

  // ==================== CHECK-IN ACTION ====================
  async function checkIn() {
    if (!user) return;
    if (reward.lastCheckIn === day()) return;

    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const streak = reward.lastCheckIn === yesterday ? Math.min(7, Number(reward.streak || 0) + 1) : 1;

    await setDoc(
      doc(db, 'user_rewards', user.uid),
      {
        points: Number(reward.points || 0) + 10,
        streak,
        lastCheckIn: day(),
        coupons: reward.coupons || [],
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    setMessage(`Day ${streak} check-in complete: +10 points`);
  }

  // ==================== SPIN ACTION ====================
  async function spin() {
    if (!user) return;
    if (reward.lastSpin === day()) return;

    const coupon = ['SAVE10', 'SAVE15', 'FREESHIP'][Math.floor(Math.random() * 3)];

    await setDoc(
      doc(db, 'user_rewards', user.uid),
      {
        points: Number(reward.points || 0) + 5,
        lastSpin: day(),
        coupons: [...(reward.coupons || []), coupon],
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    setMessage(`You won ${coupon}. It is saved to your account.`);
  }

  return (
    <main className="min-h-screen bg-[#F4F4F1] px-4 py-6 pb-28">
      <div className="mx-auto max-w-md space-y-4">
        {/* POINTS DISPLAY BADGE */}
        <section className="rounded-[30px] bg-[#14140F] p-6 text-white shadow-md">
          <Sparkles className="text-[#FFB020] w-6 h-6" />
          <h1 className="mt-3 text-3xl font-black">Rewards Hub</h1>
          <p className="mt-2 text-xs text-white/60">{user.email}</p>
          <p className="mt-5 text-3xl font-black text-[#FFB020]">{reward.points || 0} points</p>
        </section>

        {/* 7-DAY STREAK CHECK-IN */}
        <section className="rounded-[30px] bg-white p-5 shadow-sm border">
          <Trophy className="text-[#E1352B] w-6 h-6" />
          <h2 className="mt-2 text-xl font-black">7-Day Check-in</h2>
          <div className="mt-4 grid grid-cols-7 gap-1">
            {Array.from({ length: 7 }, (_, i) => (
              <span
                key={i}
                className={`rounded-lg p-2 text-center text-[9px] font-black ${
                  i < Number(reward.streak || 0) ? 'bg-[#0F6A5F] text-white' : 'bg-[#F4F4F1] text-gray-500'
                }`}
              >
                D{i + 1}
              </span>
            ))}
          </div>
          <button
            disabled={reward.lastCheckIn === day()}
            onClick={checkIn}
            className="mt-4 w-full rounded-xl bg-[#14140F] py-3 text-xs font-black text-white disabled:opacity-50"
          >
            {reward.lastCheckIn === day() ? 'Checked in today' : 'Check in +10 points'}
          </button>
        </section>

        {/* SPIN WHEEL */}
        <section className="rounded-[30px] bg-white p-5 shadow-sm border">
          <Zap className="text-[#FFB020] w-6 h-6" />
          <h2 className="mt-2 text-xl font-black">Spin & Win</h2>
          <button
            disabled={reward.lastSpin === day()}
            onClick={spin}
            className="mt-4 w-full rounded-xl bg-[#E1352B] py-4 text-xs font-black text-white disabled:opacity-50"
          >
            {reward.lastSpin === day() ? 'Come back tomorrow' : 'Spin for a coupon'}
          </button>
        </section>

        {/* SAVED COUPONS */}
        <section className="rounded-[30px] bg-white p-5 shadow-sm border">
          <Gift className="text-[#0F6A5F] w-6 h-6" />
          <h2 className="mt-2 text-lg font-black">Saved Coupons</h2>
          <p className="mt-2 text-xs text-black/60 font-mono">
            {reward.coupons?.length ? reward.coupons.join(' · ') : 'No coupons yet.'}
          </p>
        </section>

        {/* TOAST MESSAGE */}
        {message && (
          <p className="rounded-xl bg-[#0F6A5F] p-3 text-center text-xs font-black text-white">
            {message}
          </p>
        )}
      </div>
    </main>
  );
}
