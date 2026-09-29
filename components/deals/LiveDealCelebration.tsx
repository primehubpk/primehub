'use client';

import { PartyPopper, Sparkles } from 'lucide-react';
import './live-deal-celebration.css';

const confetti = Array.from({ length: 18 }, (_, index) => index);

export default function LiveDealCelebration({ day }: { day: string }) {
  return <div className="deal-celebration relative mt-5 overflow-hidden rounded-[28px] px-5 py-8 text-center text-white shadow-[0_22px_50px_rgba(144,65,24,.2)] md:py-10" aria-label={`${day} live deal celebration`}>
    <div className="deal-celebration-glow" aria-hidden="true" />
    <div className="deal-celebration-burst deal-celebration-burst-left" aria-hidden="true">✦</div>
    <div className="deal-celebration-burst deal-celebration-burst-right" aria-hidden="true">✦</div>
    <div className="deal-celebration-confetti" aria-hidden="true">{confetti.map((index) => <i key={index} style={{ left: `${(index * 47) % 97}%`, animationDuration: `${5 + index % 4}s`, animationDelay: `${index * -.47}s` }} />)}</div>
    <div className="relative z-10 mx-auto flex max-w-lg flex-col items-center">
      <span className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/15 px-4 py-2 text-[10px] font-black uppercase tracking-[.2em] backdrop-blur-sm"><Sparkles size={14} /> Today’s celebration <Sparkles size={14} /></span>
      <h2 className="mt-4 flex items-center justify-center gap-2 text-2xl font-black tracking-tight sm:text-4xl"><PartyPopper size={24} className="shrink-0 text-[#FFE193]" /> {day} Deal Is Live! <PartyPopper size={24} className="shrink-0 text-[#FFE193]" /></h2>
      <p className="mt-2 text-sm font-semibold text-white/90">Special price is unlocked today. Celebrate and shop before midnight!</p>
    </div>
  </div>;
}
