'use client';

import Link from 'next/link';
import { ArrowLeft, Check, Crown, Gift, ShieldCheck, Sparkles, WalletCards } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const benefits = [
  { icon: Crown, title: 'Exclusive Reseller Tiers', text: 'Unlock better rewards as your monthly activity grows.' },
  { icon: WalletCards, title: 'Reward Wallet', text: 'Build a reward balance from eligible reseller activity.' },
  { icon: Gift, title: 'Monthly Gifts & Bonuses', text: 'Complete monthly challenges to unlock special rewards.' },
  { icon: Sparkles, title: 'Special Reseller Deals', text: 'Get access to selected offers made for PrimeHub resellers.' },
];

export default function ResellerPage() {
  return (
    <main className="min-h-screen bg-[#F4F4F1] text-[#14140F]">
      <Header />

      <section className="relative overflow-hidden bg-[#14140F] px-4 pb-10 pt-6 text-white sm:px-6">
        <div className="absolute -right-24 -top-20 h-64 w-64 rounded-full bg-[#FFB020]/20 blur-3xl" />
        <div className="absolute -bottom-28 -left-20 h-64 w-64 rounded-full bg-[#0F6A5F]/45 blur-3xl" />
        <div className="relative mx-auto max-w-3xl">
          <Link href="/" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-[10px] font-bold text-white/80 ring-1 ring-white/10">
            <ArrowLeft size={13} /> Back to shopping
          </Link>

          <div className="mt-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFB020]/15 ring-1 ring-[#FFB020]/20">
            <Crown size={28} className="text-[#FFCF68]" />
          </div>
          <p className="mt-6 text-[9px] font-black uppercase tracking-[0.24em] text-[#FFCF68]">PrimeHub Exclusive</p>
          <h1 className="mt-2 max-w-xl text-3xl font-black tracking-tight sm:text-5xl">PrimeHub Reseller Club</h1>
          <p className="mt-3 text-base font-semibold text-white/65 sm:text-lg">Buy More • Save More • Earn More</p>
          <p className="mt-4 max-w-xl text-sm leading-6 text-white/55">Turn your regular PrimeHub shopping into a smarter reward journey with reseller tiers, a reward wallet and monthly challenges.</p>

          <Link href="/reseller/join" className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-black text-[#14140F] shadow-xl transition active:scale-[0.98] sm:w-auto">
            Join Now <span aria-hidden>→</span>
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-7 sm:px-6">
        <div className="mb-4">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#E1352B]">Why join</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight">Built for PrimeHub resellers</h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {benefits.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-[24px] border border-white/70 bg-white/75 p-4 shadow-[0_10px_28px_rgba(20,20,15,0.05)] backdrop-blur">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0F6A5F]/10 text-[#0F6A5F]"><Icon size={18} /></div>
              <h3 className="mt-3 text-sm font-black">{title}</h3>
              <p className="mt-1 text-[11px] leading-5 text-black/50">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-8 sm:px-6">
        <div className="rounded-[28px] border border-[#0F6A5F]/10 bg-gradient-to-br from-[#0F6A5F] to-[#0B4F47] p-5 text-white shadow-[0_16px_40px_rgba(15,106,95,0.18)] sm:p-7">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/55">Coming with your membership</p>
          <h2 className="mt-2 text-xl font-black">Progress through reseller tiers</h2>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {['Starter', 'Prime', 'Pro', 'Elite'].map((tier, index) => (
              <div key={tier} className="rounded-2xl bg-white/[0.08] p-3 ring-1 ring-white/[0.08]">
                <div className="flex items-center gap-1.5 text-[10px] font-black"><Check size={12} className="text-[#FFCF68]" /> {tier}</div>
                <p className="mt-1 text-[8px] text-white/45">Tier {index + 1}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-10 sm:px-6">
        <div className="rounded-[24px] border border-black/5 bg-white/70 p-4 text-[10px] leading-5 text-black/45">
          <div className="flex items-center gap-2 font-black text-[#14140F]"><ShieldCheck size={14} /> Transparent rewards</div>
          <p className="mt-1">Eligible orders, reward percentages, monthly challenges and withdrawal rules will be shown clearly before you join.</p>
        </div>
      </section>

      <Footer />
    </main>
  );
}
