'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Zap } from 'lucide-react';
import { WEEKDAY_LABELS, countdownParts, dealTiming } from '@/lib/weeklyDealUtils';
import { money, titleOf, type Product } from './ProductDetailTypes';
import type { WeeklyDeal } from '@/lib/types';

type Props = { product: Product; rating: number; reviews: number; currentDeal?: WeeklyDeal; activeDeal?: boolean; liveDeal: boolean; dealPrice: number; regularPrice: number; productOriginal: number; normalForDeal: number; savingsAmount: number; afterPricing?: ReactNode };

export default function ProductPricing({ product, currentDeal, activeDeal = false, liveDeal, dealPrice, regularPrice, productOriginal, normalForDeal, savingsAmount, afterPricing }: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!currentDeal || liveDeal) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [currentDeal, liveDeal]);
  const timing = currentDeal ? dealTiming(currentDeal.day, new Date(now)) : null;
  const countdown = !liveDeal && timing ? countdownParts(Math.max(0, timing.unlockAt.getTime() - now)) : null;
  const dealDay = currentDeal ? WEEKDAY_LABELS[currentDeal.day] : '';
  const showDeal = Boolean(currentDeal || activeDeal);
  const dealLabel = activeDeal && !currentDeal ? 'Big Deal' : 'Weekly Flash Deal';

  return <>
    <div className="mt-3 flex flex-wrap items-center gap-2">{product.isFlashSale && <span className="flex items-center gap-1 rounded-full bg-[#14140F] px-2.5 py-1 text-[9px] font-black text-white"><Zap size={10} />Flash Sale</span>}</div>
    <h1 className="mt-3 text-2xl font-black leading-tight tracking-tight text-[#14140F] sm:text-3xl md:text-[34px]">{titleOf(product)}</h1>

    {showDeal ? <div className="mt-5 overflow-hidden rounded-[26px] border border-[#E1352B]/15 bg-gradient-to-br from-white via-[#FCFCFA] to-[#FFF5F3] shadow-sm">
      <div className="bg-[#14140F] px-4 py-3 text-white sm:px-5"><div className="flex items-center justify-between gap-3"><span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-white/65"><Zap size={12} fill="currentColor" />{dealLabel}</span><span className={`rounded-full px-2.5 py-1 text-[8px] font-black uppercase tracking-wider ${liveDeal ? 'bg-[#0F6A5F] text-white' : 'bg-white/10 text-white/70'}`}>{liveDeal ? 'Live now' : 'Locked'}</span></div><p className="mt-2 text-base font-black uppercase tracking-[0.08em]">{activeDeal && !currentDeal ? 'BIG DEAL — LIVE NOW' : liveDeal ? `${dealDay} DEAL — LIVE NOW` : `UPCOMING ${dealDay} DEAL`}</p>{!liveDeal && currentDeal && <p className="mt-1 text-[9px] font-bold text-white/55">Special deal price unlocks on {dealDay}.</p>}</div>{!activeDeal && !liveDeal && countdown && <div className="px-4 pt-4 sm:px-5"><p className="mb-2 text-center text-[8px] font-black uppercase tracking-[0.2em] text-black/40">Unlocks in</p><div className="grid grid-cols-4 gap-1.5 sm:gap-2">{[['days', countdown.days], ['hours', countdown.hours], ['minutes', countdown.minutes], ['seconds', countdown.seconds]].filter(([unit]) => unit !== 'days' || countdown.days > 0).map(([unit, value]) => <div key={String(unit)} className="rounded-2xl border border-black/6 bg-white px-1.5 py-2.5 text-center shadow-sm sm:px-2"><div className="font-[family-name:var(--font-mono)] text-base font-black leading-none text-[#14140F] sm:text-lg">{String(value).padStart(2, '0')}</div><div className="mt-1 text-[6px] font-black uppercase tracking-wider text-black/35 sm:text-[7px]">{unit === 'hours' ? 'hrs' : unit === 'minutes' ? 'min' : unit === 'seconds' ? 'sec' : 'days'}</div></div>)}</div></div>}
      <div className="p-4 sm:p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[8px] font-black uppercase tracking-[0.18em] text-[#E1352B]">{liveDeal ? 'Deal price — live now' : 'Deal price when unlocked'}</p><span className="font-[family-name:var(--font-mono)] text-3xl font-black tracking-tight text-[#E1352B] sm:text-4xl">{money(dealPrice)}</span></div><div className="text-right"><p className="text-[8px] font-black uppercase tracking-[0.16em] text-black/35">Current store price</p><span className="text-sm font-black text-black/40 line-through">{money(normalForDeal)}</span></div></div>{savingsAmount > 0 && <div className="mt-3"><span className="inline-flex rounded-full bg-[#0F6A5F] px-3 py-1.5 text-[9px] font-black text-white">SAVE {money(savingsAmount)}</span></div>}{!liveDeal ? <div className="mt-4 rounded-2xl bg-[#14140F]/[0.04] p-3"><p className="text-[9px] font-bold leading-4 text-black/55">Buy now at <span className="font-black text-[#14140F]">{money(regularPrice)}</span> or wait until the {dealDay || 'deal'} unlock for the special deal price.</p></div> : <div className="mt-4 flex items-center gap-2 rounded-2xl bg-[#0F6A5F]/10 px-3 py-2.5 text-[9px] font-black text-[#0F6A5F]"><Zap size={13} fill="currentColor" /> Special deal price is active now.</div>}</div>
    </div> : <div className="mt-5 rounded-[24px] border border-black/7 bg-[#FCFCFA] p-4 sm:p-5"><div className="flex flex-wrap items-end gap-x-3 gap-y-1"><div><p className="text-[8px] font-black uppercase tracking-[0.18em] text-[#14140F]/45">Current price</p><span className="font-[family-name:var(--font-mono)] text-3xl font-black tracking-tight text-[#14140F] sm:text-4xl">{money(regularPrice)}</span></div>{productOriginal > regularPrice && <span className="mb-1 text-sm font-bold text-black/35 line-through">{money(productOriginal)}</span>}</div></div>}

    {afterPricing}
  </>;
}
