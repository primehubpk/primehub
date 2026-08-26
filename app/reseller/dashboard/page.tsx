'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { ArrowLeft, Check, Crown, Gift, ShoppingBag, Sparkles, WalletCards } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { getTierForMonthlyOrders, getTierProgress, getResellerTiers } from '@/lib/resellerTiers';
import type { ResellerProfile } from '@/lib/resellerTypes';

export default function ResellerDashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ResellerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(auth, async (user) => {
    if (!user) { router.replace('/reseller/join'); return; }
    const snap = await getDoc(doc(db, 'reseller_profiles', user.uid));
    if (!snap.exists()) { router.replace('/reseller/join'); return; }
    setProfile(snap.data() as ResellerProfile);
    setLoading(false);
  }), [router]);

  if (loading || !profile) return <main className="min-h-screen bg-[#F5F4EF] text-[#14140F]"><div className="flex min-h-screen items-center justify-center px-5 text-center text-sm font-bold text-black/45">Loading your PrimeHub Reseller Club…</div></main>;

  const monthlyOrders = profile.monthlyOrders;
  const walletAvailable = profile.walletAvailable;
  const walletPending = profile.walletPending;
  const currentTier = getTierForMonthlyOrders(monthlyOrders);
  const progress = getTierProgress(monthlyOrders);
  const tiers = getResellerTiers();
  const challengePercent = Math.min(100, Math.round((monthlyOrders / 10) * 100));
  const challengeRemaining = Math.max(0, 10 - monthlyOrders);

  return <main className="min-h-screen overflow-x-hidden bg-[#F5F4EF] text-[#14140F]">
    <section className="bg-gradient-to-br from-[#11130E] via-[#171A12] to-[#0F665B] px-4 pb-8 pt-5 text-white sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link href="/reseller" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-2 text-[10px] font-black text-white/75 ring-1 ring-white/10"><ArrowLeft size={13}/> Reseller Club</Link>
        <div className="mt-7 flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#FFCF68] text-[#15150F] shadow-[0_10px_30px_rgba(255,207,104,.2)]"><Crown size={27}/></div>
          <div><p className="text-[9px] font-black uppercase tracking-[0.24em] text-[#FFCF68]">PrimeHub Exclusive</p><h1 className="mt-1 text-[25px] font-black leading-tight sm:text-3xl">PrimeHub Reseller<br className="sm:hidden"/> Special Program</h1><p className="mt-2 text-[11px] leading-5 text-white/60">Buy More • Save More • Earn More</p></div>
        </div>
        <p className="mt-5 max-w-xl text-[11px] leading-5 text-white/65">Welcome to your reseller journey. Complete eligible orders, unlock higher tiers and build rewards in your PrimeHub wallet.</p>
        <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Stat icon={<ShoppingBag size={15}/>} label="Monthly Orders" value={`${monthlyOrders}`} tone="gold" />
          <Stat icon={<WalletCards size={15}/>} label="Available" value={`Rs. ${walletAvailable.toLocaleString()}`} tone="green" />
          <Stat icon={<Crown size={15}/>} label="Your Tier" value={currentTier.name} tone="blue" />
          <Stat icon={<Gift size={15}/>} label="Reward Rate" value={`${currentTier.rewardPercent}%`} tone="pink" />
        </div>
      </div>
    </section>

    <section className="mx-auto max-w-3xl space-y-4 px-4 py-5 sm:px-6 sm:py-7">
      <div className="overflow-hidden rounded-[28px] bg-gradient-to-br from-[#FFF0B8] via-[#FFF8DE] to-[#E1F5EF] p-5 shadow-[0_14px_40px_rgba(20,20,15,.07)] ring-1 ring-black/[.04]">
        <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-[#C23B32]"><Sparkles size={14}/><p className="text-[9px] font-black uppercase tracking-[0.22em]">Monthly Challenge</p></div><h2 className="mt-1.5 text-[22px] font-black leading-tight">10 orders = your choice</h2></div><span className="rounded-full bg-white/80 px-3 py-1.5 text-[9px] font-black text-[#0F6A5F]">{monthlyOrders}/10</span></div>
        <p className="mt-2 text-[11px] leading-5 text-black/55">Complete 10 eligible orders this month and choose your PrimeHub reward.</p>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-black/10"><div className="h-full rounded-full bg-[#0F6A5F] transition-all" style={{width:`${challengePercent}%`}} /></div>
        <div className="mt-4 grid grid-cols-2 gap-2.5"><div className="rounded-2xl bg-white/75 p-3"><Gift size={17} className="text-[#C23B32]"/><p className="mt-2 text-[11px] font-black">Free PrimeHub Gift</p><p className="mt-1 text-[9px] text-black/45">Special gift from PrimeHub</p></div><div className="rounded-2xl bg-white/75 p-3"><span className="text-[17px] font-black text-[#0F6A5F]">Rs. 1K</span><p className="mt-2 text-[11px] font-black">Cash Reward</p><p className="mt-1 text-[9px] text-black/45">Choose Rs. 1,000 instead</p></div></div>
        <div className="mt-4 rounded-2xl bg-[#14140F] px-4 py-3 text-[10px] font-bold text-white/75">{challengeRemaining === 0 ? '🎉 Challenge complete — reward selection will appear here.' : `${challengeRemaining} more eligible order${challengeRemaining === 1 ? '' : 's'} to unlock your reward.`}</div>
      </div>

      <div className="rounded-[28px] bg-white p-5 shadow-[0_12px_35px_rgba(20,20,15,.06)] ring-1 ring-black/[.03]">
        <div className="flex items-end justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#E1352B]">Your reseller tier</p><h2 className="mt-1 text-[22px] font-black">Grow your rewards</h2></div><span className="rounded-full bg-[#0F6A5F]/10 px-3 py-1.5 text-[9px] font-black text-[#0F6A5F]">{currentTier.name} • {currentTier.rewardPercent}%</span></div>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">{tiers.map((tier, index) => { const active = monthlyOrders >= tier.minMonthlyOrders; return <div key={tier.id} className={`rounded-2xl p-3 ring-1 ${active ? 'bg-[#E5F6F1] ring-[#0F6A5F]/15' : 'bg-[#F7F6F2] ring-black/[.04]'}`}><div className="flex items-center justify-between"><Crown size={16} className={active ? 'text-[#0F6A5F]' : 'text-black/20'}/>{active && <Check size={13} className="text-[#0F6A5F]"/>}</div><p className="mt-3 text-[11px] font-black">{tier.name}</p><p className="mt-1 text-lg font-black">{tier.rewardPercent}%</p><p className="mt-1 text-[8px] text-black/40">{tier.minMonthlyOrders}+ orders</p></div>})}</div>
        {progress.next ? <p className="mt-4 rounded-2xl bg-[#FFF4D1] px-3.5 py-3 text-[10px] font-bold text-[#795B00]">🔥 {progress.remaining} more order{progress.remaining === 1 ? '' : 's'} to reach <strong>{progress.next.name}</strong> and unlock {progress.next.rewardPercent}% rewards.</p> : <p className="mt-4 rounded-2xl bg-[#E5F6F1] px-3.5 py-3 text-[10px] font-bold text-[#0F6A5F]">👑 Elite unlocked — you are at the highest reseller tier.</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-[26px] bg-gradient-to-br from-[#DDF5F0] to-[#F3FFFC] p-5 shadow-[0_12px_35px_rgba(15,106,95,.08)] ring-1 ring-[#0F6A5F]/10"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#0F6A5F]"><WalletCards size={20}/></div><p className="mt-4 text-[9px] font-black uppercase tracking-[0.2em] text-[#0F6A5F]">Reward Wallet</p><h2 className="mt-1 text-2xl font-black">Rs. {walletAvailable.toLocaleString()}</h2><p className="mt-1 text-[10px] text-black/45">Available reward balance</p><div className="mt-4 rounded-2xl bg-white/75 p-3"><p className="text-[8px] font-black uppercase tracking-wider text-black/35">Pending</p><p className="mt-1 text-sm font-black">Rs. {walletPending.toLocaleString()}</p></div></div>
        <div className="rounded-[26px] bg-gradient-to-br from-[#FFE0DC] to-[#FFF7F4] p-5 shadow-[0_12px_35px_rgba(193,59,50,.07)] ring-1 ring-[#E1352B]/10"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#C23B32]"><Gift size={20}/></div><p className="mt-4 text-[9px] font-black uppercase tracking-[0.2em] text-[#C23B32]">More Rewards</p><h2 className="mt-1 text-xl font-black">Special reseller benefits</h2><p className="mt-2 text-[10px] leading-5 text-black/45">Tasks, monthly gifts, special deals and wallet rewards are being connected to your reseller activity.</p><Link href="/rewards" className="mt-4 inline-flex rounded-xl bg-[#14140F] px-4 py-2.5 text-[10px] font-black text-white">Explore Rewards →</Link></div>
      </div>

      <div className="rounded-[26px] bg-[#14140F] p-5 text-white shadow-[0_14px_40px_rgba(20,20,15,.12)]"><p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#FFCF68]">How you earn</p><div className="mt-4 grid gap-3 sm:grid-cols-3"><Step n="01" title="Shop & order" text="Place eligible PrimeHub orders while signed in."/><Step n="02" title="Get approved" text="Confirmed orders become eligible for rewards."/><Step n="03" title="Earn & withdraw" text="Rewards move to your wallet for withdrawal."/></div></div>
    </section>
  </main>;
}

function Stat({icon,label,value,tone}:{icon:React.ReactNode;label:string;value:string;tone:'gold'|'green'|'blue'|'pink'}) { const styles={gold:'bg-[#FFCF68]/10 text-[#FFCF68]',green:'bg-[#75D8C9]/10 text-[#75D8C9]',blue:'bg-[#A8C7FF]/10 text-[#A8C7FF]',pink:'bg-[#FF9B93]/10 text-[#FF9B93]'}; return <div className={`rounded-2xl p-3 ring-1 ring-white/10 ${styles[tone]}`}><div className="flex items-center gap-1.5"><span>{icon}</span><span className="text-[8px] font-black uppercase tracking-wider text-white/45">{label}</span></div><p className="mt-1 text-sm font-black text-white">{value}</p></div>; }

function Step({n,title,text}:{n:string;title:string;text:string}) { return <div className="rounded-2xl bg-white/[.06] p-3 ring-1 ring-white/[.08]"><span className="text-[9px] font-black text-[#FFCF68]">{n}</span><p className="mt-2 text-[11px] font-black">{title}</p><p className="mt-1 text-[9px] leading-4 text-white/45">{text}</p></div>; }
