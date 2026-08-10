'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { ArrowRight, CalendarDays, Clock3, Flame } from 'lucide-react';
import { db } from '@/lib/firebase';

type DealProduct = {
  id: string;
  title?: string;
  price?: number;
  originalPrice?: number;
  compareAtPrice?: number;
  imageUrl?: string;
  images?: string[];
  dealDay?: string;
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function currentDayName() {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date());
}

function millisecondsUntilMidnight() {
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  return Math.max(0, midnight.getTime() - Date.now());
}

function formatCountdown(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000);
  return { hours: Math.floor(seconds / 3600), minutes: Math.floor((seconds % 3600) / 60), seconds: seconds % 60 };
}

function getPrice(product: DealProduct) { return Number(product.price || 0); }
function getOriginalPrice(product: DealProduct) { return Number(product.originalPrice ?? product.compareAtPrice ?? 0); }

export default function HeroFlashBanner() {
  const [today, setToday] = useState(currentDayName);
  const [deals, setDeals] = useState<DealProduct[]>([]);
  const [remaining, setRemaining] = useState(millisecondsUntilMidnight);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, 'products'), where('dealDay', 'in', DAYS)),
      (snapshot) => setDeals(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as DealProduct[]),
      () => setDeals([])
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setToday(currentDayName());
      setRemaining(millisecondsUntilMidnight());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const todayDeal = deals.find((product) => product.dealDay === today) || null;
  const countdown = useMemo(() => formatCountdown(remaining), [remaining]);
  const price = todayDeal ? getPrice(todayDeal) : 0;
  const originalPrice = todayDeal ? getOriginalPrice(todayDeal) : 0;
  const discount = originalPrice > price && price > 0 ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;
  const imageUrl = todayDeal?.imageUrl || todayDeal?.images?.[0];

  return (
    <section className="mx-4 mt-3 overflow-hidden rounded-[28px] bg-[#14140F] text-white shadow-[0_18px_50px_rgba(20,20,15,0.16)]">
      <div className="border-b border-white/10 px-3 pt-3 sm:px-5"><div className="mb-2 flex items-center gap-2 px-1 text-[9px] font-black uppercase tracking-[0.18em] text-white/55"><CalendarDays size={12} /> One Day Deals — new deal every day</div><div className="flex gap-1 overflow-x-auto pb-3 [scrollbar-width:none]">{DAYS.map((day) => { const active = day === today; const hasDeal = deals.some((product) => product.dealDay === day); return <span key={day} className={['min-w-[66px] rounded-2xl border px-2 py-2 text-center transition', active ? 'border-[#FFB020] bg-[#FFB020] text-[#14140F] shadow-[0_0_22px_rgba(255,176,32,0.28)]' : 'border-white/10 bg-white/5 text-white/60'].join(' ')}><span className="block text-[9px] font-black uppercase">{day.slice(0, 3)}</span><span className="mt-1 block text-[8px] font-bold">{active ? 'TODAY' : hasDeal ? 'READY' : 'COMING'}</span></span>; })}</div></div>
      <Link href={todayDeal ? `/product/${todayDeal.id}` : '/shop'} className="relative block min-h-[390px]">{imageUrl && <img src={imageUrl} alt={todayDeal?.title || 'Today’s deal'} className="absolute inset-0 h-full w-full object-cover opacity-75" />}<div className="absolute inset-0 bg-gradient-to-t from-[#14140F] via-[#14140F]/65 to-transparent" /><div className="relative flex min-h-[390px] flex-col justify-end p-5 sm:p-7"><div className="mb-auto flex items-center justify-between gap-3"><span className="inline-flex items-center gap-1.5 rounded-full bg-[#E1352B] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em]"><Flame size={13} /> {today} Deal</span><span className="rounded-full bg-[#FFB020] px-3 py-1.5 text-xs font-black text-[#14140F]">{discount > 0 ? `-${discount}% OFF` : 'TODAY ONLY'}</span></div><div className="max-w-xl"><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/65">One day only</p><h2 className="text-3xl font-black leading-[0.95] tracking-tight sm:text-5xl">Big Deal. Today Only.</h2><h3 className="mt-3 text-lg font-bold sm:text-2xl">{todayDeal?.title || 'Today’s featured deal is being prepared'}</h3>{price > 0 && <div className="mt-4 flex items-end gap-3"><span className="font-[family-name:var(--font-mono)] text-3xl font-black text-[#FFB020]">Rs. {price.toLocaleString()}</span>{originalPrice > price && <span className="pb-1 text-sm text-white/55 line-through">Rs. {originalPrice.toLocaleString()}</span>}</div>}<div className="mt-4 flex flex-wrap items-center gap-2"><div className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 backdrop-blur-md"><Clock3 size={14} /><span className="text-[10px] font-bold uppercase tracking-wider text-white/70">Ends in</span><span className="font-[family-name:var(--font-mono)] text-sm font-bold">{String(countdown.hours).padStart(2, '0')}:{String(countdown.minutes).padStart(2, '0')}:{String(countdown.seconds).padStart(2, '0')}</span></div><span className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-black text-[#14140F]">Shop deal <ArrowRight size={14} /></span></div></div></div></Link>
    </section>
  );
}
