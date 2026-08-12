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

function pakistanDay() {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Karachi', weekday: 'long' }).format(new Date()).toLowerCase() as Weekday;
}
function pakistanParts() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Karachi', weekday: 'long', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(now);
  return { year: Number(parts.find((p) => p.type === 'year')?.value), month: Number(parts.find((p) => p.type === 'month')?.value), day: Number(parts.find((p) => p.type === 'day')?.value), now };
}
function millisecondsUntilPakistanMidnight() {
  const current = pakistanParts();
  const tomorrowUtc = Date.UTC(current.year, current.month - 1, current.day + 1, 0, 0, 0) - 5 * 60 * 60 * 1000;
  return Math.max(0, tomorrowUtc - current.now.getTime());
}
function countdownParts(milliseconds: number) {
  const total = Math.floor(milliseconds / 1000);
  return { hours: Math.floor(total / 3600), minutes: Math.floor((total % 3600) / 60), seconds: total % 60 };
}

export default function HeroFlashBanner() {
  const { settings } = useSettings();
  const [nowTick, setNowTick] = useState(Date.now());
  const todayKey = pakistanDay();
  const weeklyDeals = settings.weeklyDeals || [];
  const todayDeal = weeklyDeals.find((deal) => deal.day === todayKey && deal.active !== false && Number(deal.dealPrice) > 0);
  const bigDeal = settings.dailyDeal;
  const countdown = useMemo(() => {
    const end = bigDeal?.endAt ? new Date(bigDeal.endAt).getTime() : 0;
    return countdownParts(end > nowTick ? end - nowTick : millisecondsUntilPakistanMidnight());
  }, [bigDeal?.endAt, nowTick]);
  const discount = bigDeal && bigDeal.originalPrice > bigDeal.dealPrice ? Math.round(((bigDeal.originalPrice - bigDeal.dealPrice) / bigDeal.originalPrice) * 100) : 0;

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return <>
    <section className="mx-4 mt-3 overflow-hidden rounded-[24px] border border-black/6 bg-white shadow-[0_12px_40px_rgba(20,20,15,0.07)]">
      <div className="flex gap-1.5 overflow-x-auto px-3 py-3 sm:px-5 [scrollbar-width:none]">
        {DAYS.map(({ key, label, Icon }) => {
          const active = key === todayKey;
          const deal = weeklyDeals.find((item) => item.day === key && item.active !== false && Number(item.dealPrice) > 0);
          return <Link key={key} href={`/deals/${key}`} className={`group relative min-w-[108px] flex-1 overflow-hidden rounded-2xl border px-2 py-2.5 text-center transition hover:-translate-y-0.5 ${active ? 'border-[#14140F] bg-[#14140F] text-white shadow-[0_8px_24px_rgba(20,20,15,0.14)]' : 'border-black/7 bg-[#FBFAF7] text-[#14140F] hover:border-[#FFB020] hover:shadow-[0_8px_24px_rgba(255,176,32,0.14)]'}`}>
            {deal?.imageUrl && <img src={deal.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35 transition group-hover:opacity-45" />}
            <span className="relative z-10 block">
              <span className={`mx-auto flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border transition group-hover:scale-105 ${active ? 'border-white/20 bg-white/10 text-[#FFB020]' : 'border-[#FFB020]/35 bg-[#FFF8E8] text-[#D69200]'}`}>
                {deal?.imageUrl ? <img src={deal.imageUrl} alt="" className="h-full w-full object-cover" /> : <Icon size={18} strokeWidth={2.2} />}
              </span>
              <span className={`mt-1.5 block whitespace-nowrap text-[10px] font-black uppercase tracking-[0.08em] ${active ? 'text-white' : ''}`}>{active ? 'TODAY' : label}</span>
              {deal && <span className={`mt-0.5 block text-[8px] font-bold ${active ? 'text-white/70' : 'text-black/50'}`}>Rs. {Number(deal.dealPrice).toLocaleString()}</span>}
            </span>
          </Link>;
        })}
      </div>
    </section>

    {bigDeal?.active && bigDeal.title && (
      <Link href="/deals/big" className="group mx-4 mt-3 block overflow-hidden rounded-[28px] bg-[#14140F] text-white shadow-[0_18px_50px_rgba(20,20,15,0.16)]">
        <section>
          <div className="relative min-h-[370px] overflow-hidden">
            {bigDeal.imageUrl && <img src={bigDeal.imageUrl} alt={bigDeal.title} className="absolute inset-0 h-full w-full object-cover opacity-90 transition duration-700 group-hover:scale-[1.02]" />}
            <div className="absolute inset-0 bg-gradient-to-t from-[#14140F]/95 via-[#14140F]/45 to-[#14140F]/10" />
            <div className="relative flex min-h-[370px] flex-col justify-end p-5 sm:p-7">
              <div className="mb-auto flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E1352B] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em]"><Zap size={13} /> Big Deal</span>
                <span className="rounded-full bg-[#FFB020] px-3 py-1.5 text-xs font-black text-[#14140F]">{discount > 0 ? `-${discount}% OFF` : 'LIMITED TIME'}</span>
              </div>
              <div className="max-w-xl">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/75">PrimeHub spotlight</p>
                <h2 className="text-3xl font-black leading-[0.95] tracking-tight sm:text-5xl">Big Deal</h2>
                <h3 className="mt-3 text-lg font-bold sm:text-2xl">{bigDeal.title}</h3>
                <div className="mt-4 flex items-end gap-3"><span className="font-[family-name:var(--font-mono)] text-3xl font-black text-[#FFB020]">Rs. {Number(bigDeal.dealPrice).toLocaleString()}</span>{Number(bigDeal.originalPrice) > Number(bigDeal.dealPrice) && <span className="pb-1 text-sm text-white/60 line-through">Rs. {Number(bigDeal.originalPrice).toLocaleString()}</span>}</div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-2 rounded-xl bg-white/12 px-3 py-2 backdrop-blur-md"><Clock3 size={14} /><span className="text-[10px] font-bold uppercase tracking-wider text-white/75">Ends in</span><span className="font-[family-name:var(--font-mono)] text-sm font-bold">{String(countdown.hours).padStart(2, '0')}:{String(countdown.minutes).padStart(2, '0')}:{String(countdown.seconds).padStart(2, '0')}</span></div>
                  <span className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-black text-[#14140F]">View Big Deal <ArrowRight size={14} /></span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </Link>
    )}
  </>;
}
