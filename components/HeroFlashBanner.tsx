'use client';

// ==================== DAILY BIG DEAL HERO ====================
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';
import { ArrowRight, Clock3, Flame } from 'lucide-react';
import { db } from '@/lib/firebase';

type DealProduct = {
  id: string;
  title?: string;
  price?: number;
  originalPrice?: number;
  imageUrl?: string;
  images?: string[];
  dealDay?: string;
};

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
  return {
    hours: Math.floor(seconds / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
  };
}

export default function HeroFlashBanner() {
  const [today, setToday] = useState(currentDayName);
  const [todayDeal, setTodayDeal] = useState<DealProduct | null>(null);
  const [fallbackDeal, setFallbackDeal] = useState<DealProduct | null>(null);
  const [remaining, setRemaining] = useState(millisecondsUntilMidnight);

  // ==================== DAILY DEAL FIRESTORE QUERIES ====================
  useEffect(() => {
    const dealQuery = query(collection(db, 'products'), where('dealDay', '==', today), limit(1));
    return onSnapshot(dealQuery, (snapshot) => {
      setTodayDeal(snapshot.empty ? null : ({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as DealProduct));
    }, () => setTodayDeal(null));
  }, [today]);

  useEffect(() => {
    return onSnapshot(query(collection(db, 'products'), limit(1)), (snapshot) => {
      setFallbackDeal(snapshot.empty ? null : ({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as DealProduct));
    }, () => setFallbackDeal(null));
  }, []);

  // ==================== MIDNIGHT COUNTDOWN ====================
  useEffect(() => {
    const timer = window.setInterval(() => {
      setRemaining(millisecondsUntilMidnight());
      setToday((previousDay) => {
        const nextDay = currentDayName();
        return previousDay === nextDay ? previousDay : nextDay;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const deal = todayDeal || fallbackDeal;
  const countdown = useMemo(() => formatCountdown(remaining), [remaining]);
  const price = Number(deal?.price || 0);
  const originalPrice = Number(deal?.originalPrice || 0);
  const discount = originalPrice > price && price > 0 ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;
  const imageUrl = deal?.imageUrl || deal?.images?.[0];

  return (
    <section className="mx-4 mt-3 overflow-hidden rounded-[28px] bg-[#14140F] text-white shadow-[0_18px_50px_rgba(20,20,15,0.16)]">
      <Link href={deal ? `/product/${deal.id}` : '/shop'} className="relative block min-h-[390px]">
        {imageUrl && <img src={imageUrl} alt={deal?.title || 'Today’s deal'} className="absolute inset-0 h-full w-full object-cover opacity-75" />}
        <div className="absolute inset-0 bg-gradient-to-t from-[#14140F] via-[#14140F]/65 to-transparent" />
        <div className="relative flex min-h-[390px] flex-col justify-end p-5 sm:p-7">
          <div className="mb-auto flex items-center justify-between gap-3"><span className="inline-flex items-center gap-1.5 rounded-full bg-[#E1352B] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em]"><Flame size={13} /> {today} Deal</span><span className="rounded-full bg-[#FFB020] px-3 py-1.5 text-xs font-black text-[#14140F]">{discount > 0 ? `-${discount}% OFF` : 'TODAY ONLY'}</span></div>
          <div className="max-w-xl"><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/65">One day only</p><h2 className="text-3xl font-black leading-[0.95] tracking-tight sm:text-5xl">Big Deal. Today Only.</h2><h3 className="mt-3 text-lg font-bold sm:text-2xl">{deal?.title || 'Today’s featured pick'}</h3>{price > 0 && <div className="mt-4 flex items-end gap-3"><span className="font-[family-name:var(--font-mono)] text-3xl font-black text-[#FFB020]">Rs. {price.toLocaleString()}</span>{originalPrice > price && <span className="pb-1 text-sm text-white/55 line-through">Rs. {originalPrice.toLocaleString()}</span>}</div>}<div className="mt-4 flex flex-wrap items-center gap-2"><div className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 backdrop-blur-md"><Clock3 size={14} /><span className="text-[10px] font-bold uppercase tracking-wider text-white/70">Ends in</span><span className="font-[family-name:var(--font-mono)] text-sm font-bold">{String(countdown.hours).padStart(2, '0')}:{String(countdown.minutes).padStart(2, '0')}:{String(countdown.seconds).padStart(2, '0')}</span></div><span className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-black text-[#14140F]">Shop deal <ArrowRight size={14} /></span></div></div>
        </div>
      </Link>
    </section>
  );
}
