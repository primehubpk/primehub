'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock3, Gift, Sparkles, Star, Tags, Trophy, WandSparkles, Zap, ArrowRight } from 'lucide-react';
import { useSettings } from '@/lib/useSettings';
import type { Weekday } from '@/lib/types';

const DAYS: Array<{ key: Weekday; label: string; Icon: typeof Gift }> = [
  { key: 'sunday', label: 'Sunday Deal', Icon: Gift }, { key: 'monday', label: 'Monday Deal', Icon: CalendarDays }, { key: 'tuesday', label: 'Tuesday Deal', Icon: Sparkles },
  { key: 'wednesday', label: 'Wednesday Deal', Icon: Star }, { key: 'thursday', label: 'Thursday Deal', Icon: Tags }, { key: 'friday', label: 'Friday Deal', Icon: Trophy }, { key: 'saturday', label: 'Saturday Deal', Icon: WandSparkles },
];

function pakistanDay() { return new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Karachi', weekday: 'long' }).format(new Date()).toLowerCase() as Weekday; }
function pakistanParts() { const now = new Date(); const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Karachi', weekday: 'long', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(now); return { year: Number(parts.find((p) => p.type === 'year')?.value), month: Number(parts.find((p) => p.type === 'month')?.value), day: Number(parts.find((p) => p.type === 'day')?.value), now }; }
function millisecondsUntilPakistanMidnight() { const current = pakistanParts(); const tomorrowUtc = Date.UTC(current.year, current.month - 1, current.day + 1, 0, 0, 0) - 5 * 60 * 60 * 1000; return Math.max(0, tomorrowUtc - current.now.getTime()); }
function countdownParts(milliseconds: number) { const total = Math.floor(milliseconds / 1000); return { hours: Math.floor(total / 3600), minutes: Math.floor((total % 3600) / 60), seconds: total % 60 }; }

export default function HeroFlashBanner() {
  const { settings } = useSettings();
  const [nowTick, setNowTick] = useState(Date.now());
  const todayKey = pakistanDay();
  const weeklyDeals = settings.weeklyDeals || [];
  const bigDeal = settings.dailyDeal;
  const countdown = useMemo(() => { const end = bigDeal?.endAt ? new Date(bigDeal.endAt).getTime() : 0; return countdownParts(end > nowTick ? end - nowTick : millisecondsUntilPakistanMidnight()); }, [bigDeal?.endAt, nowTick]);
  const discount = bigDeal && bigDeal.originalPrice > bigDeal.dealPrice ? Math.round(((bigDeal.originalPrice - bigDeal.dealPrice) / bigDeal.originalPrice) * 100) : 0;

  useEffect(() => { const timer = window.setInterval(() => setNowTick(Date.now()), 1000); return () => window.clearInterval(timer); }, []);

  const todayDeal = weeklyDeals.find((item) => item.day === todayKey && item.active !== false && Number(item.dealPrice) > 0);

  return <>
    <section className="mx-4 mt-3 overflow-hidden rounded-[26px] border border-black/8 bg-white shadow-[0_14px_42px_rgba(20,20,15,0.09)]">
      <div className="flex gap-2 overflow-x-auto px-3 py-3.5 sm:px-5 [scrollbar-width:none]">
        {DAYS.map(({ key, label, Icon }) => {
          const active = key === todayKey;
          const deal = weeklyDeals.find((item) => item.day === key && item.active !== false && Number(item.dealPrice) > 0);
          const discount = deal && Number(deal.originalPrice || 0) > Number(deal.dealPrice) ? Math.round(((Number(deal.originalPrice) - Number(deal.dealPrice)) / Number(deal.originalPrice)) * 100) : 0;
          return <Link key={key} href={`/deals/${key}`} className={`group relative min-w-[112px] flex-1 overflow-hidden rounded-[20px] border px-2.5 py-3 text-center transition duration-200 ${active ? 'border-[#0F6A5F] bg-[#0F6A5F] text-white shadow-[0_10px_26px_rgba(15,106,95,0.2)]' : deal ? 'border-[#E1352B]/20 bg-gradient-to-b from-[#FFF9F5] to-white text-[#14140F] shadow-[0_10px_24px_rgba(225,53,43,0.10)] hover:-translate-y-1 hover:border-[#E1352B]/45 hover:shadow-[0_14px_30px_rgba(225,53,43,0.18)]' : 'border-black/7 bg-[#FCFBF8] text-[#14140F] hover:-translate-y-0.5 hover:border-[#0F6A5F]/25 hover:shadow-[0_10px_26px_rgba(20,20,15,0.08)]'}`}>
            <span className="relative z-10 block">
              {deal?.imageUrl ? (
                <span className="relative mx-auto block h-20 w-20 overflow-hidden rounded-2xl border-2 border-white bg-white shadow-[0_8px_18px_rgba(20,20,15,0.18)]">
                  <img src={deal.imageUrl} alt={label} className="h-full w-full scale-125 object-cover transition duration-200 group-hover:scale-[1.34]" />
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-[#E1352B] px-1.5 py-0.5 text-[6px] font-black uppercase tracking-[0.08em] text-white shadow-sm">Sale</span>
                  {discount > 0 && <span className="absolute bottom-1.5 right-1.5 rounded-full bg-[#FFD16A] px-1.5 py-0.5 text-[7px] font-black text-[#14140F] shadow-sm">-{discount}%</span>}
                </span>
              ) : (
                <span className={`mx-auto flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border ${active ? 'border-white/20 bg-white/10 text-[#FFD16A]' : 'border-[#0F6A5F]/12 bg-white text-[#0F6A5F]'}`}>
                  {deal?.imageUrl ? <img src={deal.imageUrl} alt="" className="h-full w-full scale-150 object-cover" /> : <Icon size={18} strokeWidth={2.3} />}
                </span>
              )}
              <span className={`mt-2 block whitespace-nowrap text-[10px] font-black uppercase tracking-[0.07em] ${active ? 'text-white' : 'text-[#14140F]'}`}>{active ? 'TODAY' : label}</span>
              {deal && <><span className={`mt-1 block text-[9px] font-bold ${active ? 'text-white/80' : 'text-[#E1352B]'}`}>Rs. {Number(deal.dealPrice).toLocaleString()}</span>{!active && <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#14140F] px-2 py-1 text-[7px] font-black uppercase tracking-[0.08em] text-white">Shop now <ArrowRight size={8}/></span>}</>}
            </span>
          </Link>;
        })}
      </div>
    </section>

    {todayDeal && <Link href={`/deals/${todayKey}`} className="group mx-4 mt-4 block overflow-hidden rounded-[28px] border border-[#0F6A5F]/12 bg-white shadow-[0_16px_42px_rgba(15,106,95,0.12)]">
      <div className="relative overflow-hidden bg-gradient-to-br from-white via-[#F8FBFA] to-[#EEF7F4]">
        <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#FFD16A]/25 blur-3xl" />
        <div className="relative grid md:grid-cols-[46%_54%]">
          <div className="relative min-h-[245px] overflow-hidden bg-[#F4F4F1] sm:min-h-[280px] md:min-h-[310px]">
            {todayDeal.imageUrl ? <img src={todayDeal.imageUrl} alt={todayDeal.title || 'Daily Deal'} className="h-full w-full object-contain object-center transition duration-700 group-hover:scale-[1.02] md:object-cover" /> : <div className="flex h-full w-full items-center justify-center text-[#0F6A5F]"><Sparkles size={38}/></div>}
            <div className="absolute inset-0 bg-gradient-to-t from-black/18 via-transparent to-transparent" />
            <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-[#0F6A5F] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-white shadow-sm"><Sparkles size={11}/> Daily Deal</span>
          </div>
          <div className="flex min-w-0 flex-col justify-center p-5 sm:p-7">
            <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#EAF7F4] px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.16em] text-[#0F6A5F]">{labelFor(todayKey)}</span><span className="rounded-full bg-[#FFF4D6] px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.14em] text-[#AA7A00]">Limited Time</span></div>
            <h3 className="mt-3 text-2xl font-black leading-tight text-[#14140F] sm:text-3xl">{todayDeal.title || labelFor(todayKey)}</h3>
            <div className="mt-3 flex flex-wrap items-end gap-2.5"><span className="text-3xl font-black text-[#0F6A5F]">Rs. {Number(todayDeal.dealPrice).toLocaleString()}</span>{Number(todayDeal.originalPrice || 0) > Number(todayDeal.dealPrice) && <span className="pb-1 text-sm text-black/35 line-through">Rs. {Number(todayDeal.originalPrice).toLocaleString()}</span>}</div>
            <p className="mt-2 text-xs leading-5 text-black/45">Exclusive scheduled offer from PrimeHub.</p>
            <div className="mt-5 flex items-center gap-3"><span className="inline-flex items-center gap-2 rounded-2xl bg-[#14140F] px-4 py-3 text-[10px] font-black text-white shadow-sm">View {labelFor(todayKey)} <ArrowRight size={14}/></span><span className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#0F6A5F]">Tap to shop</span></div>
          </div>
        </div>
      </div>
    </Link>}

    {bigDeal?.active && bigDeal.title && <Link href="/deals/big" className="group mx-4 mt-4 block overflow-hidden rounded-[30px] bg-[#0F6A5F] text-white shadow-[0_20px_52px_rgba(15,106,95,0.22)]">
      <section><div className="relative min-h-[390px] overflow-hidden">
        {bigDeal.imageUrl && <img src={bigDeal.imageUrl} alt={bigDeal.title} className="absolute inset-0 h-full w-full object-cover object-center opacity-95 transition duration-700 group-hover:scale-[1.02]" />}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B4F47]/94 via-[#0F6A5F]/28 to-transparent" />
        <div className="relative flex min-h-[390px] flex-col justify-end p-5 sm:p-8">
          <div className="mb-auto flex items-center justify-between gap-3"><span className="rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#0F6A5F]">Big Deal</span><span className="rounded-full bg-[#FFD16A] px-3 py-1.5 text-xs font-black text-[#14140F]">{discount > 0 ? `-${discount}% OFF` : 'LIMITED TIME'}</span></div>
          <div className="max-w-lg"><h2 className="text-3xl font-black leading-none tracking-tight sm:text-5xl">{bigDeal.title}</h2><div className="mt-4 flex items-end gap-3"><span className="text-3xl font-black text-[#FFD16A]">Rs. {Number(bigDeal.dealPrice).toLocaleString()}</span>{Number(bigDeal.originalPrice) > Number(bigDeal.dealPrice) && <span className="pb-1 text-sm text-white/60 line-through">Rs. {Number(bigDeal.originalPrice).toLocaleString()}</span>}</div><div className="mt-4 flex flex-wrap items-center gap-2"><div className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-black/15 px-3 py-2.5 backdrop-blur-md"><Clock3 size={14}/><span className="text-[10px] font-bold uppercase tracking-wider text-white/80">Ends in</span><span className="font-[family-name:var(--font-mono)] text-sm font-bold">{String(countdown.hours).padStart(2,'0')}:{String(countdown.minutes).padStart(2,'0')}:{String(countdown.seconds).padStart(2,'0')}</span></div><span className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-black text-[#0F6A5F]">View Deal <ArrowRight size={14}/></span></div></div>
        </div>
      </div></section>
    </Link>}
  </>;
}

function labelFor(day: Weekday) { return `${day.charAt(0).toUpperCase()}${day.slice(1)} Deal`; }
