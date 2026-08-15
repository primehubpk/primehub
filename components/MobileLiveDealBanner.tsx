'use client';

import { Clock3, Zap } from 'lucide-react';
import { countdownParts } from '@/lib/weeklyDealUtils';

type Props = {
  live: boolean;
  countdown: ReturnType<typeof countdownParts> | null;
};

export default function MobileLiveDealBanner({ live, countdown }: Props) {
  if (!live) return null;
  const timer = countdown
    ? `${countdown.hours.toString().padStart(2, '0')}:${countdown.minutes.toString().padStart(2, '0')}:${countdown.seconds.toString().padStart(2, '0')}`
    : '—';

  return (
    <section className="mx-3 mb-4 rounded-[24px] bg-[#14140F] p-4 text-white shadow-lg md:hidden">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#FFD166]">🎉 MEGA CELEBRATION SALE</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm font-black"><Zap size={14} fill="currentColor" /> LIVE TODAY'S DEAL</p>
        </div>
        <div className="shrink-0 rounded-xl bg-white/10 px-3 py-2 text-center">
          <Clock3 size={12} className="mx-auto mb-1 text-[#FFD166]" />
          <span className="font-[family-name:var(--font-mono)] text-sm font-black">{timer}</span>
        </div>
      </div>
    </section>
  );
}
