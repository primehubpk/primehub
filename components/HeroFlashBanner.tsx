'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Clock3, Gift, Sparkles, Star, Tags, Trophy, WandSparkles, ShoppingCart } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { useSettings } from '@/lib/useSettings';
import { useCartStore } from '@/lib/cartStore';
import { db } from '@/lib/firebase';
import type { Product, Weekday } from '@/lib/types';

const DAYS: Array<{ key: Weekday; label: string; Icon: typeof Gift }> = [
  { key: 'sunday', label: 'Sunday Deal', Icon: Gift }, { key: 'monday', label: 'Monday Deal', Icon: Gift }, { key: 'tuesday', label: 'Tuesday Deal', Icon: Sparkles },
  { key: 'wednesday', label: 'Wednesday Deal', Icon: Star }, { key: 'thursday', label: 'Thursday Deal', Icon: Tags }, { key: 'friday', label: 'Friday Deal', Icon: Trophy }, { key: 'saturday', label: 'Saturday Deal', Icon: WandSparkles },
];

function pakistanDay() { return new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Karachi', weekday: 'long' }).format(new Date()).toLowerCase() as Weekday; }
function pakistanParts() { const now = new Date(); const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Karachi', weekday: 'long', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(now); return { year: Number(parts.find((p) => p.type === 'year')?.value), month: Number(parts.find((p) => p.type === 'month')?.value), day: Number(parts.find((p) => p.type === 'day')?.value), now }; }
function millisecondsUntilPakistanMidnight() { const current = pakistanParts(); const tomorrowUtc = Date.UTC(current.year, current.month - 1, current.day + 1, 0, 0, 0) - 5 * 60 * 60 * 1000; return Math.max(0, tomorrowUtc - current.now.getTime()); }
function countdownParts(milliseconds: number) { const total = Math.floor(milliseconds / 1000); return { hours: Math.floor(total / 3600), minutes: Math.floor((total % 3600) / 60), seconds: total % 60 }; }

export default function HeroFlashBanner() {
  const { settings } = useSettings();
  const [nowTick, setNowTick] = useState(Date.now());
  const [products, setProducts] = useState<Record<string, Product>>({});
  const todayKey = pakistanDay();
  const weeklyDeals = settings.weeklyDeals || [];
  const bigDeal = settings.dailyDeal;
  const addItem = useCartStore((state) => state.addItem);
  const countdown = useMemo(() => { const end = bigDeal?.endAt ? new Date(bigDeal.endAt).getTime() : 0; return countdownParts(end > nowTick ? end - nowTick : millisecondsUntilPakistanMidnight()); }, [bigDeal?.endAt, nowTick]);
  const discount = bigDeal && bigDeal.originalPrice > bigDeal.dealPrice ? Math.round(((bigDeal.originalPrice - bigDeal.dealPrice) / bigDeal.originalPrice) * 100) : 0;

  useEffect(() => { const timer = window.setInterval(() => setNowTick(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => onSnapshot(collection(db, 'products'), (snapshot) => { const next: Record<string, Product> = {}; snapshot.forEach((doc) => { next[doc.id] = { id: doc.id, ...doc.data() } as Product; }); setProducts(next); }, () => setProducts({})), []);

  const orderedDays = useMemo(() => {
    const todayIndex = DAYS.findIndex(({ key }) => key === todayKey);
    if (todayIndex < 0) return DAYS;
    return [...DAYS.slice(todayIndex), ...DAYS.slice(0, todayIndex)];
  }, [todayKey]);

  function addDealToCart(deal: NonNullable<typeof weeklyDeals>[number]) {
    const product = products[deal.productId];
    const regularPrice = Number(product?.price || deal.originalPrice || deal.dealPrice || 0);
    const dealPrice = Number(deal.dealPrice || 0);
    const isLiveToday = deal.day === todayKey && deal.active !== false && dealPrice > 0;
    const price = isLiveToday ? dealPrice : regularPrice;
    if (!deal.productId || price <= 0 || Number(product?.stock ?? 1) <= 0) return;
    const image = product?.imageUrl || deal.imageUrl;
    addItem({ id: deal.productId, name: product?.title || deal.title, price, originalPrice: isLiveToday ? Number(product?.originalPrice || deal.originalPrice || price) : regularPrice, image, imageUrl: image, dealDay: isLiveToday ? deal.day : undefined });
  }

  function addBigDealToCart() {
    if (!bigDeal?.productId) return;
    addItem({ id: bigDeal.productId, name: bigDeal.title, price: Number(bigDeal.dealPrice), originalPrice: Number(bigDeal.originalPrice || bigDeal.dealPrice), image: bigDeal.imageUrl, imageUrl: bigDeal.imageUrl });
  }

  return <>
    <section id="weekly-deals" className="mx-4 mt-3 scroll-mt-4">
      <div className="mb-3 flex items-center justify-between gap-3 rounded-[22px] border border-black/8 bg-white px-4 py-3 shadow-sm sm:px-5">
        <div><p className="text-[8px] font-black uppercase tracking-[0.2em] text-[#E1352B]">Deals every day</p><h2 className="mt-0.5 text-lg font-black tracking-tight sm:text-xl">Weekly Deals</h2></div>
        <Link href="/weekly-deals" className="inline-flex shrink-0 items-center rounded-full bg-[#14140F] px-4 py-2.5 text-[9px] font-black uppercase tracking-[0.1em] text-white transition hover:bg-[#0F6A5F]">View All Deals</Link>
      </div>

      <div className="overflow-hidden rounded-[26px] border border-black/8 bg-white shadow-[0_14px_42px_rgba(20,20,15,0.09)]">
        <div className="flex gap-2 overflow-x-auto px-3 py-3.5 sm:px-5 [scrollbar-width:none]">
          {orderedDays.map(({ key, label, Icon }) => {
            const active = key === todayKey;
            const deal = weeklyDeals.find((item) => item.day === key && item.active !== false && Number(item.dealPrice) > 0);
            const dealDiscount = deal && Number(deal.originalPrice || 0) > Number(deal.dealPrice) ? Math.round(((Number(deal.originalPrice) - Number(deal.dealPrice)) / Number(deal.originalPrice)) * 100) : 0;
            const product = deal ? products[deal.productId] : undefined;
            const regularPrice = Number(product?.price || deal?.originalPrice || 0);
            const dealPrice = Number(deal?.dealPrice || 0);
            const isLiveToday = Boolean(deal && active && deal.active !== false && dealPrice > 0);
            const displayPrice = isLiveToday ? dealPrice : regularPrice;
            const cardClass = active ? 'border-emerald-500 bg-white text-[#14140F] shadow-[0_12px_28px_rgba(16,185,129,0.16)]' : deal ? 'border-[#E1352B]/20 bg-gradient-to-b from-[#FFF9F5] to-white text-[#14140F] shadow-[0_10px_24px_rgba(225,53,43,0.10)] hover:-translate-y-1 hover:border-[#E1352B]/45 hover:shadow-[0_14px_30px_rgba(225,53,43,0.18)]' : 'border-black/7 bg-[#FCFBF8] text-[#14140F] hover:-translate-y-0.5 hover:border-[#0F6A5F]/25 hover:shadow-[0_10px_26px_rgba(20,20,15,0.08)]';
            return <div key={key} className={'group relative min-w-[112px] flex-1 overflow-hidden rounded-[20px] border-2 text-center transition duration-200 ' + cardClass}>
              {active && <span className="absolute right-2 top-2 z-20 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[6px] font-black uppercase tracking-[0.08em] text-white shadow-sm">Live today</span>}
              {deal?.imageUrl ? <Link href={`/product/${deal.productId}`} aria-label={`View ${deal.title}`} className="block"><span className="relative block aspect-[4/3] w-full overflow-hidden"><img src={deal.imageUrl} alt={label} className="h-full w-full object-cover transition duration-200 group-hover:scale-105" /><span className="absolute left-1.5 top-1.5 rounded-full bg-[#E1352B] px-1.5 py-0.5 text-[6px] font-black uppercase tracking-[0.08em] text-white shadow-sm">{isLiveToday ? 'Sale' : label}</span>{isLiveToday && dealDiscount > 0 && <span className="absolute bottom-1.5 right-1.5 rounded-full bg-[#FFD16A] px-1.5 py-0.5 text-[7px] font-black text-[#14140F] shadow-sm">-{dealDiscount}%</span>}</span></Link> : <span className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-[#F4F4F1] text-[#0F6A5F]"><Icon size={18} strokeWidth={2.3} /></span>}
              <span className="relative z-10 block px-2.5 pb-3 pt-2"><span className="block whitespace-nowrap text-[10px] font-black uppercase tracking-[0.07em] text-[#14140F]">{active ? "TODAY'S DEAL" : label}</span>{deal && displayPrice > 0 && <><span className="mt-1 block text-[9px] font-bold text-[#E1352B]">Rs. {displayPrice.toLocaleString()}</span>{isLiveToday && regularPrice > displayPrice && <span className="block text-[8px] text-black/35 line-through">Rs. {regularPrice.toLocaleString()}</span>}<button type="button" onClick={() => addDealToCart(deal)} className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#14140F] px-2 py-1 text-[7px] font-black uppercase tracking-[0.08em] text-white hover:bg-[#0F6A5F]"><ShoppingCart size={8}/> Add to Cart</button></>}</span>
            </div>;
          })}
        </div>
      </div>
    </section>

    {bigDeal?.active && bigDeal.title && <section className="group mx-4 mt-4 block overflow-hidden rounded-[30px] bg-[#0F6A5F] text-white shadow-[0_20px_52px_rgba(15,106,95,0.22)]"><div className="relative min-h-[390px] overflow-hidden">{bigDeal.imageUrl && <img src={bigDeal.imageUrl} alt={bigDeal.title} className="absolute inset-0 h-full w-full object-cover object-center opacity-95 transition duration-700 group-hover:scale-[1.02]" />}<div className="absolute inset-0 bg-gradient-to-t from-[#0B4F47]/94 via-[#0F6A5F]/28 to-transparent" /><div className="relative flex min-h-[390px] flex-col justify-end p-5 sm:p-8"><div className="mb-auto flex items-center justify-between gap-3"><span className="rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#0F6A5F]">Big Deal</span><span className="rounded-full bg-[#FFD16A] px-3 py-1.5 text-xs font-black text-[#14140F]">{discount > 0 ? `-${discount}% OFF` : 'LIMITED TIME'}</span></div><div className="max-w-lg"><h2 className="text-3xl font-black leading-none tracking-tight sm:text-5xl">{bigDeal.title}</h2><div className="mt-4 flex items-end gap-3"><span className="text-3xl font-black text-[#FFD16A]">Rs. {Number(bigDeal.dealPrice).toLocaleString()}</span>{Number(bigDeal.originalPrice) > Number(bigDeal.dealPrice) && <span className="pb-1 text-sm text-white/60 line-through">Rs. {Number(bigDeal.originalPrice).toLocaleString()}</span>}</div><div className="mt-4 flex flex-wrap items-center gap-2"><div className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-black/15 px-3 py-2.5 backdrop-blur-md"><Clock3 size={14}/><span className="text-[10px] font-bold uppercase tracking-wider text-white/80">Ends in</span><span className="font-[family-name:var(--font-mono)] text-sm font-bold">{String(countdown.hours).padStart(2,'0')}:{String(countdown.minutes).padStart(2,'0')}:{String(countdown.seconds).padStart(2,'0')}</span></div><button type="button" onClick={addBigDealToCart} disabled={!bigDeal.productId} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-black text-[#0F6A5F] disabled:cursor-not-allowed disabled:opacity-60"><ShoppingCart size={14}/> Add to Cart</button></div></div></div></div></section>}
  </>;
}
