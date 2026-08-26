'use client';

import Link from 'next/link';
import { ArrowLeft, Check, ChevronRight, Crown, Gift, ShieldCheck, Sparkles, WalletCards } from 'lucide-react';
import Footer from '@/components/Footer';

const benefits = [
  { icon: Crown, title: 'Exclusive Reseller Tiers', text: 'Unlock better rewards as your monthly activity grows.', tone: 'bg-[#FFF0C2] text-[#9A6500]', border: 'border-[#F4D98A]' },
  { icon: WalletCards, title: 'Reward Wallet', text: 'Build a reward balance from eligible reseller activity.', tone: 'bg-[#DDF5F0] text-[#0F6A5F]', border: 'border-[#B8E5DC]' },
  { icon: Gift, title: 'Monthly Gifts & Bonuses', text: 'Complete monthly challenges to unlock special rewards.', tone: 'bg-[#FFE0DC] text-[#C83B31]', border: 'border-[#F5C1BA]' },
  { icon: Sparkles, title: 'Special Reseller Deals', text: 'Get access to selected offers made for PrimeHub resellers.', tone: 'bg-[#E9E1FF] text-[#6B45B5]', border: 'border-[#D4C6F7]' },
];

export default function ResellerPage() {
  return (
    <main className="min-h-screen bg-[#F4F4F1] text-[#14140F]">
      <section className="relative overflow-hidden bg-gradient-to-br from-[#151610] via-[#173A34] to-[#0F6A5F] px-4 pb-9 pt-5 text-white sm:px-6">
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[#FFCF68]/15 blur-3xl" />
        <div className="relative mx-auto max-w-3xl">
          <Link href="/" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-[10px] font-bold text-white/85 ring-1 ring-white/15">
            <ArrowLeft size={13} /> Back to shopping
          </Link>
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
        <div className="space-y-3">
          {benefits.map(({ icon: Icon, title, text, tone, border }) => (
            <div key={title} className={`rounded-[24px] border ${border} bg-white p-4 shadow-[0_10px_28px_rgba(20,20,15,0.05)]`}>
              <div className="flex items-start gap-3"><div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tone}`}><Icon size={20} /></div><div className="min-w-0 flex-1"><h3 className="text-sm font-black">{title}</h3><p className="mt-1 text-[10px] leading-5 text-black/50">{text}</p></div></div>
              <Link href="/reseller/join?mode=signup" className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#14140F] py-2.5 text-[10px] font-black text-white">Join Now <ChevronRight size={13} /></Link>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-8 sm:px-6"><div className="rounded-[28px] bg-gradient-to-br from-[#FFF0C2] via-[#FFE5D8] to-[#DDF5F0] p-5 shadow-[0_16px_40px_rgba(20,20,15,0.07)] sm:p-7"><p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#E1352B]">Your reseller journey</p><h2 className="mt-2 text-xl font-black">Progress through four exclusive tiers</h2><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{['Starter', 'Prime', 'Pro', 'Elite'].map((tier, index) => <div key={tier} className="rounded-2xl bg-white/70 p-3 ring-1 ring-black/5"><div className="flex items-center gap-1.5 text-[10px] font-black"><Check size={12} className="text-[#0F6A5F]" /> {tier}</div><p className="mt-1 text-[8px] text-black/45">Tier {index + 1}</p></div>)}</div><Link href="/reseller/join?mode=signup" className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0F6A5F] py-3 text-[10px] font-black text-white">Join the Club <ChevronRight size={14} /></Link></div></section>

      <section className="mx-auto max-w-3xl px-4 pb-10 sm:px-6"><div className="rounded-[24px] border border-black/5 bg-white p-4 text-[10px] leading-5 text-black/45"><div className="flex items-center gap-2 font-black text-[#14140F]"><ShieldCheck size={14} className="text-[#0F6A5F]" /> Transparent rewards</div><p className="mt-1">Eligible orders, reward percentages, monthly challenges and withdrawal rules will be shown clearly before you join.</p></div></section>
      <Footer />
    </main>
  );
}
