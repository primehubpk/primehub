'use client';

import Link from 'next/link';
import { ArrowRight, Crown } from 'lucide-react';

export default function ResellerClubCard() {
  return (
    <Link
      href="/reseller"
      className="group relative block overflow-hidden rounded-[28px] border border-white/50 bg-gradient-to-br from-[#14140F] via-[#173C36] to-[#0B4F47] px-4 py-3.5 text-white shadow-[0_10px_28px_rgba(15,106,95,0.14)] transition active:scale-[0.98]"
    >
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#FFB020]/20 blur-2xl" />
      <div className="relative">
        <div className="flex items-center justify-between gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-[#FFCF68]">
            <Crown size={18} />
          </div>
          <span className="rounded-full bg-[#FFB020]/15 px-2 py-1 text-[7px] font-black uppercase text-[#FFD979]">
            Club
          </span>
        </div>
        <p className="mt-3 text-[8px] font-black uppercase tracking-[0.16em] text-white/55">
          PrimeHub Exclusive
        </p>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className="text-sm font-black leading-tight">Prime Reseller Club</p>
          <ArrowRight size={14} className="shrink-0 text-white/70 transition group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}
