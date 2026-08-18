'use client';

import { Zap } from 'lucide-react';

type Props = { live: boolean; countdown: unknown };

export default function MobileLiveDealBanner({ live }: Props) {
  if (!live) return null;
  return <section className="live-deal-mobile-banner mx-3 mb-4 overflow-x-auto overflow-y-visible touch-pan-y rounded-[24px] bg-gradient-to-r from-[#8a4b00] via-[#FFD166] to-[#0F6A5F] p-[2px] shadow-lg md:hidden">
    <div className="min-w-0 rounded-[22px] bg-gradient-to-br from-[#2b1600] via-[#14140F] to-[#063b35] p-4 text-white sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="mb-1 text-[8px] font-black uppercase tracking-[0.14em] text-[#FFD166]">🎉 MEGA CELEBRATION SALE — LOWEST PRICE EVER!</div><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/80"><span className="h-2 w-2 animate-pulse rounded-full bg-[#FFB020]" />Live Deal <span aria-hidden="true">🎉 🎆 💥</span></div><p className="mt-1 text-xl font-black">⚡ LIVE TODAY'S DEAL</p></div></div>
    </div>
  </section>;
}
