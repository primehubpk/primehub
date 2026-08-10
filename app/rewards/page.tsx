'use client';

// ==================== FIREBASE AUTH REWARDS HUB ====================
import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { Gift, Sparkles, Trophy, Zap } from 'lucide-react';
import { auth, db } from '@/lib/firebase';

type Reward = { points?: number; streak?: number; lastCheckIn?: string; lastSpin?: string; coupons?: string[] };
const day = () => new Date().toISOString().slice(0, 10);

export default function RewardsPage() {
  const [user, setUser] = useState<User | null>(null); const [reward, setReward] = useState<Reward>({}); const [message, setMessage] = useState('');
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => { if (!user) return; return onSnapshot(doc(db, 'user_rewards', user.uid), (snap) => setReward((snap.data() || {}) as Reward)); }, [user]);
  if (!user) return <main className="min-h-screen bg-[#F4F4F1] p-8 text-center"><h1 className="text-2xl font-black">PrimeHub Rewards</h1><p className="mt-3 text-sm text-black/50">Sign in with a Firebase customer account to save your points, streak, and coupons.</p></main>;
  async function checkIn() { if (reward.lastCheckIn === day()) return; const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0,10); const streak = reward.lastCheckIn === yesterday ? Math.min(7, Number(reward.streak || 0) + 1) : 1; await setDoc(doc(db,'user_rewards',user.uid), { points: Number(reward.points || 0) + 10, streak, lastCheckIn: day(), coupons: reward.coupons || [], updatedAt: serverTimestamp() }, { merge:true }); setMessage(`Day ${streak} check-in complete: +10 points`); }
  async function spin() { if (reward.lastSpin === day()) return; const coupon = ['SAVE10','SAVE15','FREESHIP'][Math.floor(Math.random()*3)]; await setDoc(doc(db,'user_rewards',user.uid), { points: Number(reward.points || 0) + 5, lastSpin: day(), coupons: [...(reward.coupons || []), coupon], updatedAt: serverTimestamp() }, { merge:true }); setMessage(`You won ${coupon}. It is saved to your account.`); }
  return <main className="min-h-screen bg-[#F4F4F1] px-4 py-6 pb-28"><div className="mx-auto max-w-md space-y-4"><section className="rounded-[30px] bg-[#14140F] p-6 text-white"><Sparkles className="text-[#FFB020]"/><h1 className="mt-3 text-3xl font-black">Rewards Hub</h1><p className="mt-2 text-xs text-white/55">{user.email}</p><p className="mt-5 text-3xl font-black text-[#FFB020]">{reward.points || 0} points</p></section><section className="rounded-[30px] bg-white p-5"><Trophy className="text-[#E1352B]"/><h2 className="mt-2 text-xl font-black">7-day check-in</h2><div className="mt-4 grid grid-cols-7 gap-1">{Array.from({length:7},(_,i)=><span key={i} className={`rounded-lg p-2 text-center text-[9px] font-black ${i < Number(reward.streak || 0) ? 'bg-[#0F6A5F] text-white':'bg-[#F4F4F1]'}`}>D{i+1}</span>)}</div><button disabled={reward.lastCheckIn===day()} onClick={checkIn} className="mt-4 w-full rounded-xl bg-[#14140F] py-3 text-xs font-black text-white">{reward.lastCheckIn===day()?'Checked in today':'Check in +10 points'}</button></section><section className="rounded-[30px] bg-white p-5"><Zap className="text-[#FFB020]"/><h2 className="mt-2 text-xl font-black">Spin & Win</h2><button disabled={reward.lastSpin===day()} onClick={spin} className="mt-4 w-full rounded-xl bg-[#E1352B] py-4 text-xs font-black text-white">{reward.lastSpin===day()?'Come back tomorrow':'Spin for a coupon'}</button></section><section className="rounded-[30px] bg-white p-5"><Gift className="text-[#0F6A5F]"/><h2 className="mt-2 text-lg font-black">Saved coupons</h2><p className="mt-2 text-xs text-black/50">{reward.coupons?.length ? reward.coupons.join(' · ') : 'No coupons yet.'}</p></section>{message && <p className="rounded-xl bg-[#0F6A5F] p-3 text-center text-xs font-black text-white">{message}</p>}</div></main>;
}
