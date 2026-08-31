'use client';

import { Crown, Gift, WalletCards, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function ResellerClubCard() {
  return (
    <Link
      href="/reseller"
      className="group relative block overflow-hidden rounded-[28px] border border-white/60 bg-gradient-to-br from-[#14140F] via-[#173C36] to-[#0B4F47] p-4 text-white shadow-[0_14px_34px_rgba(15,106,95,0.18)] transition active:scale-[0.985] sm:p-5"
      aria-label="Join PrimeHub Reseller Club"
    >
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#FFB020]/20 blur-2xl" />
      <div className="absolute -bottom-12 left-10 h-28 w-28 rounded-full bg-[#E1352B]/20 blur-2xl" />

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/10">
            <Crown size={21} className="text-[#FFCF68]" />
          </div>
          <span className="rounded-full bg-[#FFB020]/15 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.14em] text-[#FFD979]">
            Special Club
          </span>
        </div>

        <p className="mt-4 text-[8px] font-black uppercase tracking-[0.2em] text-white/55">PrimeHub Exclusive</p>
        <h3 className="mt-1 text-[17px] font-black leading-tight">PrimeHub Reseller Club</h3>
        <p className="mt-1 text-[10px] font-semibold text-white/65">Buy More • Save More • Earn More</p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-white/[0.07] px-2 py-2.5 ring-1 ring-white/[0.06]">
            <Gift size={13} className="text-[#FFCF68]" />
            <p className="mt-1 text-[8px] font-bold text-white/70">Gifts</p>
          </div>
          <div className="rounded-2xl bg-white/[0.07] px-2 py-2.5 ring-1 ring-white/[0.06]">
            <WalletCards size={13} className="text-[#FFCF68]" />
            <p className="mt-1 text-[8px] font-bold text-white/70">Rewards</p>
          </div>
          <div className="rounded-2xl bg-white/[0.07] px-2 py-2.5 ring-1 ring-white/[0.06]">
            <Crown size={13} className="text-[#FFCF68]" />
            <p className="mt-1 text-[8px] font-bold text-white/70">Tiers</p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-full bg-white px-3.5 py-2.5 text-[#14140F]">
          <span className="text-[10px] font-black">Join Now</span>
          <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}
