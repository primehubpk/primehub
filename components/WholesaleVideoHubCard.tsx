'use client';

import Link from 'next/link';
import { ArrowRight, Play } from 'lucide-react';

export default function WholesaleVideoHubCard() {
  return (
    <Link
      href="/wholesale-video-hub"
      className="group relative block overflow-hidden rounded-[28px] border border-white/50 bg-gradient-to-br from-[#3A1512] via-[#A92C24] to-[#E1352B] px-4 py-3.5 text-white shadow-[0_10px_28px_rgba(225,53,43,0.14)] transition active:scale-[0.98]"
    >
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#FFB020]/25 blur-2xl" />
      <div className="relative">
        <div className="flex items-center justify-between gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/12">
            <Play size={18} fill="currentColor" />
          </div>
          <span className="rounded-full bg-white/12 px-2 py-1 text-[7px] font-black uppercase">
            Wholesale
          </span>
        </div>
        <p className="mt-3 text-[8px] font-black uppercase tracking-[0.16em] text-white/60">
          PrimeHub Collection
        </p>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className="text-sm font-black leading-tight">Prime Wholesale Packages</p>
          <ArrowRight size={14} className="shrink-0 text-white/75 transition group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}
