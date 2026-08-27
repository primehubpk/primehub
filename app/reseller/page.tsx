'use client';

import Link from 'next/link';
import { ArrowLeft, Check, ChevronRight, Crown, Gift, ShieldCheck, Sparkles, WalletCards } from 'lucide-react';
import Footer from '@/components/Footer';

const benefits = [
  { icon: Crown, title: 'Exclusive Reseller Tiers', text: 'Unlock better rewards as your monthly activity grows.', tone: 'bg-[#FFF0C2] text-[#9A6500]' },
  { icon: WalletCards, title: 'Reward Wallet', text: 'Build a reward balance from eligible reseller activity.', tone: 'bg-[#DDF5F0] text-[#0F6A5F]' },
  { icon: Gift, title: 'Monthly Gifts & Bonuses', text: 'Complete monthly challenges to unlock special rewards.', tone: 'bg-[#FFE0DC] text-[#C83B31]' },
  { icon: Sparkles, title: 'Special Reseller Deals', text: 'Get access to selected offers made for PrimeHub resellers.', tone: 'bg-[#E9E1FF] text-[#6B45B5]' },
];

export default function ResellerPage() {
  return (
    <main className="min-h-screen bg-[#F4F4F1] text-[#14140F]">
      <section className="relative overflow-hidden bg-gradient-to-br from-[#151610] via-[#173A34] to-[#0F6A5F] px-4 pb-9 pt-5 text-white sm:px-6">
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[#FFCF68]/15 blur-3xl" />
        <div className="relative mx-auto max-w-3xl">
          <Link href="/" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-[10px] font-bold text-white/85 ring-1 ring-white/15"><ArrowLeft size={13} /> Back to shopping</Link>
          <div className="mt-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFCF68] text-[#14140F] shadow-lg"><Crown size={28} /></div>
          <p className="mt-5 text-[9px] font-black uppercase tracking-[0.24em] text-[#FFCF68]">PrimeHub Exclusive</p>
          <h1 className="mt-2 max-w-xl text-3xl font-black tracking-tight sm:text-5xl">PrimeHub Reseller Club</h1>
          <p className="mt-2 text-base font-bold text-white/80 sm:text-lg">Buy More • Save More • Earn More</p>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/65">Turn your regular PrimeHub shopping into a smarter reward journey with reseller tiers, a reward wallet and monthly challenges.</p>
          <Link href="/reseller/join?mode=signup" className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-black text-[#14140F] shadow-xl active:scale-[0.98]">Join Now <ChevronRight size={17} /></Link>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-7 sm:px-6">
        <div className="mb-4"><p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#E1352B]">Why join</p><h2 className="mt-1 text-2xl font-black tracking-tight">Built for PrimeHub resellers</h2></div>
        <div className="rounded-[28px] border border-black/5 bg-white p-4 shadow-[0_14px_38px_rgba(20,20,15,0.07)] sm:p-5">
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {benefits.map(({ icon: Icon, title, text, tone }) => (
              <div key={title} className="min-w-0 rounded-[20px] border border-black/5 bg-[#FAFAF7] p-3 sm:p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${tone} sm:h-11 sm:w-11`}><Icon size={19} /></div><div className="min-w-0"><h3 className="text-[11px] font-black leading-4 sm:text-sm">{title}</h3><p className="mt-1 text-[9px] leading-4 text-black/50 sm:text-[10px] sm:leading-5">{text}</p></div></div>
              </div>
            ))}
          </div>
          <Link href="/reseller/join?mode=signup" className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#14140F] py-3.5 text-sm font-black text-white shadow-lg active:scale-[0.99]">Join Now <ChevronRight size={16} /></Link>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-8 sm:px-6"><div className="rounded-[28px] bg-gradient-to-br from-[#FFF0C2] via-[#FFE5D8] to-[#DDF5F0] p-5 shadow-[0_16px_40px_rgba(20,20,15,0.07)] sm:p-7"><p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#E1352B]">Your reseller journey</p><h2 className="mt-2 text-xl font-black">Progress through four exclusive tiers</h2><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{['Starter', 'Prime', 'Pro', 'Elite'].map((tier, index) => <div key={tier} className="rounded-2xl bg-white/70 p-3 ring-1 ring-black/5"><div className="flex items-center gap-1.5 text-[10px] font-black"><Check size={12} className="text-[#0F6A5F]" /> {tier}</div><p className="mt-1 text-[8px] text-black/45">Tier {index + 1}</p></div>)}</div><Link href="/reseller/join?mode=signup" className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0F6A5F] py-3 text-[10px] font-black text-white">Join the Club <ChevronRight size={14} /></Link></div></section>

      <section className="mx-auto max-w-3xl px-4 pb-10 sm:px-6"><div className="rounded-[24px] border border-black/5 bg-white p-4 text-[10px] leading-5 text-black/45"><div className="flex items-center gap-2 font-black text-[#14140F]"><ShieldCheck size={14} className="text-[#0F6A5F]" /> Transparent rewards</div><p className="mt-1">Eligible orders, reward percentages, monthly challenges and withdrawal rules will be shown clearly before you join.</p></div></section>
      <Footer />
    </main>
  );
}
