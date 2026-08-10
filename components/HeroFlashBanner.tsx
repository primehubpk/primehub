'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, Clock3, Flame } from 'lucide-react';
import { useSettings } from '@/lib/useSettings';
import type { Weekday, WeeklyDeal } from '@/lib/types';

const DAYS: Array<{ key: Weekday; label: string }> = [
  { key: 'monday', label: 'Monday' }, { key: 'tuesday', label: 'Tuesday' }, { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' }, { key: 'friday', label: 'Friday' }, { key: 'saturday', label: 'Saturday' }, { key: 'sunday', label: 'Sunday' },
];
const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;

function pakistanParts() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Karachi', weekday: 'long', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(now);
  return { weekday: parts.find((p) => p.type === 'weekday')?.value?.toLowerCase() as Weekday, year: Number(parts.find((p) => p.type === 'year')?.value), month: Number(parts.find((p) => p.type === 'month')?.value), day: Number(parts.find((p) => p.type === 'day')?.value), now };
}
function dayIndex(day: Weekday) { return DAYS.findIndex((item) => item.key === day); }
function millisecondsUntilStart(day: Weekday) {
  const current = pakistanParts();
  let delta = dayIndex(day) - dayIndex(current.weekday);
  if (delta <= 0) delta += 7;
  const targetUtc = Date.UTC(current.year, current.month - 1, current.day + delta, 0, 0, 0) - PKT_OFFSET_MS;
  return Math.max(0, targetUtc - current.now.getTime());
}
function millisecondsUntilEnd() {
  const current = pakistanParts();
  const tomorrowUtc = Date.UTC(current.year, current.month - 1, current.day + 1, 0, 0, 0) - PKT_OFFSET_MS;
  return Math.max(0, tomorrowUtc - current.now.getTime());
}
function countdownParts(milliseconds: number) { const total = Math.floor(milliseconds / 1000); return { days: Math.floor(total / 86400), hours: Math.floor((total % 86400) / 3600), minutes: Math.floor((total % 3600) / 60), seconds: total % 60 }; }
function currentDay(): Weekday { return pakistanParts().weekday; }
function dealForDay(deals: WeeklyDeal[], day: Weekday) { return deals.find((deal) => deal.day === day && deal.active) || null; }

export default function HeroFlashBanner() {
  const { settings } = useSettings();
  const [selectedDay, setSelectedDay] = useState<Weekday>(() => currentDay());
  const [nowTick, setNowTick] = useState(Date.now());
  const deals = settings.weeklyDeals || [];
  const today = currentDay();
  const selectedDeal = dealForDay(deals, selectedDay);
  const isToday = selectedDay === today;
  const countdown = useMemo(() => countdownParts(isToday ? millisecondsUntilEnd() : millisecondsUntilStart(selectedDay)), [isToday, selectedDay, nowTick]);
  const discount = selectedDeal && selectedDeal.originalPrice > selectedDeal.dealPrice ? Math.round(((selectedDeal.originalPrice - selectedDeal.dealPrice) / selectedDeal.originalPrice) * 100) : 0;

  useEffect(() => { const timer = window.setInterval(() => setNowTick(Date.now()), 1000); return () => window.clearInterval(timer); }, []);

  return <section className="mx-4 mt-3 overflow-hidden rounded-[28px] bg-[#14140F] text-white shadow-[0_18px_50px_rgba(20,20,15,0.16)]">
    <div className="border-b border-white/10 px-3 pt-3 sm:px-5"><div className="mb-2 flex items-center gap-2 px-1 text-[9px] font-black uppercase tracking-[0.18em] text-white/55"><CalendarDays size={12} /> One Day Deals — new deal every day</div><div className="flex gap-1 overflow-x-auto pb-3 [scrollbar-width:none]">{DAYS.map(({ key, label }) => { const deal = dealForDay(deals, key); const active = key === today; const future = dayIndex(key) >= dayIndex(today); return <button key={key} type="button" onClick={() => setSelectedDay(key)} className={['min-w-[86px] rounded-2xl border px-2 py-2 text-center transition', selectedDay === key ? 'border-[#FFB020] bg-[#FFB020] text-[#14140F] shadow-[0_0_22px_rgba(255,176,32,0.28)]' : 'border-white/10 bg-white/5 text-white/60', 'hover:border-[#FFB020]/60'].join(' ')}><span className="block text-[9px] font-black uppercase">{label.slice(0, 3)}</span><span className="mt-1 block text-[8px] font-bold">{active ? 'TODAY' : deal ? future ? 'STARTS SOON' : 'ENDED' : 'NO DEAL'}</span></button>; })}</div></div>
    <Link href={selectedDeal ? `/product/${selectedDeal.productId}` : '/shop'} className="relative block min-h-[390px]">{selectedDeal?.imageUrl && <img src={selectedDeal.imageUrl} alt={selectedDeal.title} className="absolute inset-0 h-full w-full object-cover opacity-75" />}<div className="absolute inset-0 bg-gradient-to-t from-[#14140F] via-[#14140F]/65 to-transparent" /><div className="relative flex min-h-[390px] flex-col justify-end p-5 sm:p-7"><div className="mb-auto flex items-center justify-between gap-3"><span className="inline-flex items-center gap-1.5 rounded-full bg-[#E1352B] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em]"><Flame size={13} /> {selectedDay} Deal</span><span className="rounded-full bg-[#FFB020] px-3 py-1.5 text-xs font-black text-[#14140F]">{isToday ? (discount > 0 ? `-${discount}% OFF` : 'TODAY ONLY') : 'PREVIEW'}</span></div><div className="max-w-xl"><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/65">{isToday ? 'One day only' : `${selectedDay} special — preview`}</p><h2 className="text-3xl font-black leading-[0.95] tracking-tight sm:text-5xl">{isToday ? 'Big Deal. Today Only.' : `${selectedDay} Deal.`}</h2><h3 className="mt-3 text-lg font-bold sm:text-2xl">{selectedDeal?.title || 'No deal scheduled yet'}</h3>{selectedDeal && <div className="mt-4 flex items-end gap-3"><span className="font-[family-name:var(--font-mono)] text-3xl font-black text-[#FFB020]">Rs. {selectedDeal.dealPrice.toLocaleString()}</span><span className="pb-1 text-sm text-white/55 line-through">Rs. {selectedDeal.originalPrice.toLocaleString()}</span></div>}<div className="mt-4 flex flex-wrap items-center gap-2"><div className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 backdrop-blur-md"><Clock3 size={14} /><span className="text-[10px] font-bold uppercase tracking-wider text-white/70">{isToday ? 'Ends in' : 'Starts in'}</span><span className="font-[family-name:var(--font-mono)] text-sm font-bold">{countdown.days > 0 ? `${countdown.days}d ` : ''}{String(countdown.hours).padStart(2, '0')}:{String(countdown.minutes).padStart(2, '0')}:{String(countdown.seconds).padStart(2, '0')}</span></div><span className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-black text-[#14140F]">{selectedDeal ? 'View deal' : 'Shop products'} <ArrowRight size={14} /></span></div></div></div></Link>
  </section>;
}
