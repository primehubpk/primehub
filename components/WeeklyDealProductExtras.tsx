'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { collection, onSnapshot } from 'firebase/firestore';
import { Clock3, LockKeyhole, ShoppingCart, Sparkles } from 'lucide-react';
import { db } from '@/lib/firebase';
import { useCartStore } from '@/lib/cartStore';
import { useSettings } from '@/lib/useSettings';
import type { Product, WeeklyDeal } from '@/lib/types';
import { WEEKDAY_LABELS, WEEKDAY_ORDER, countdownParts, dealTiming } from '@/lib/weeklyDealUtils';

export default function WeeklyDealProductExtras({ productId }: { productId: string }) {
  const { settings } = useSettings();
  const addItem = useCartStore((state) => state.addItem);
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [nowTick, setNowTick] = useState<number | null>(null);

  useEffect(() => {
    setNowTick(Date.now());
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => onSnapshot(collection(db, 'products'), (snapshot) => {
    const next: Record<string, Product> = {};
    snapshot.forEach((doc) => { next[doc.id] = { id: doc.id, ...doc.data() } as Product; });
    setProducts(next);
  }, () => setProducts({})), []);

  const deals = settings.weeklyDeals || [];
  const currentDeal = deals.find((deal) => deal.productId === productId && deal.active !== false && Number(deal.dealPrice) > 0);
  const timing = currentDeal && nowTick !== null ? dealTiming(currentDeal.day, new Date(nowTick)) : null;
  const live = Boolean(currentDeal && timing?.isLive);
  const product = products[productId];
  const normalPrice = Number(product?.price || currentDeal?.originalPrice || 0);
  const dealPrice = Number(currentDeal?.dealPrice || 0);
  const savings = normalPrice > dealPrice ? normalPrice - dealPrice : 0;
  const countdown = timing && nowTick !== null ? countdownParts(timing.unlockAt.getTime() - nowTick) : null;

  const otherDeals = useMemo(() => deals.filter((deal) => deal.active !== false && deal.productId && deal.productId !== productId).sort((a, b) => WEEKDAY_ORDER.indexOf(a.day) - WEEKDAY_ORDER.indexOf(b.day)), [deals, productId]);

  if (!currentDeal || nowTick === null) return null;

  return (
    <section className="mx-auto max-w-5xl px-3 md:px-5">
      <div className="mb-4 rounded-[24px] border border-black/8 bg-white p-4 shadow-sm md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[#0F6A5F]">{live ? <Sparkles size={15} /> : <LockKeyhole size={15} />}<span className="text-[9px] font-black uppercase tracking-[0.18em]">Weekly Deal</span></div>
            <h2 className="mt-1 text-lg font-black">{live ? "Today's deal is LIVE" : `🔒 Unlocks ${WEEKDAY_LABELS[currentDeal.day]}`}</h2>
          </div>
          <div className="rounded-2xl bg-[#F4F4F1] px-3 py-2 text-right"><p className="text-[8px] font-black uppercase tracking-[0.16em] text-black/40">{live ? 'Deal price' : 'Deal price when unlocked'}</p><p className="font-[family-name:var(--font-mono)] text-lg font-black text-[#E1352B]">Rs. {dealPrice.toLocaleString()}</p></div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-[#0F6A5F] p-3 text-white sm:col-span-2"><div className="flex items-center gap-2"><Clock3 size={14} /><span className="text-[9px] font-black uppercase tracking-wider text-white/75">{live ? 'Deal ends in' : 'Unlocks in'}</span></div><p className="mt-1 font-[family-name:var(--font-mono)] text-xl font-black">{countdown ? `${countdown.days}d ${countdown.hours.toString().padStart(2,'0')}h ${countdown.minutes.toString().padStart(2,'0')}m ${countdown.seconds.toString().padStart(2,'0')}s` : '—'}</p><p className="mt-1 text-[9px] font-bold text-white/65">{live ? 'The deal price is active for today and locks again at midnight.' : `The special price activates automatically when ${WEEKDAY_LABELS[currentDeal.day]} begins.`}</p></div>
          <div className="rounded-2xl bg-[#F4F4F1] p-3"><p className="text-[8px] font-black uppercase tracking-[0.16em] text-black/40">Normal price</p><p className="mt-1 text-lg font-black line-through text-black/40">Rs. {normalPrice.toLocaleString()}</p><p className="mt-1 text-[10px] font-black text-[#0F6A5F]">You save Rs. {savings.toLocaleString()} when unlocked</p></div>
        </div>
      </div>

      {otherDeals.length > 0 && (
        <div className="pb-8">
          <div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-[8px] font-black uppercase tracking-[0.2em] text-[#E1352B]">Keep browsing</p><h2 className="mt-0.5 text-xl font-black">More Weekly Deals</h2></div><Link href="/weekly-deals" className="text-[9px] font-black uppercase tracking-wider text-[#0F6A5F]">View all</Link></div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {otherDeals.map((deal: WeeklyDeal) => {
              const item = products[deal.productId];
              const image = item?.imageUrl || deal.imageUrl || '';
              const normal = Number(item?.price || deal.originalPrice || 0);
              const dealP = Number(deal.dealPrice || 0);
              const isLive = nowTick !== null && dealTiming(deal.day, new Date(nowTick)).isLive;
              const display = isLive ? dealP : normal;
              return <article key={deal.id} className="overflow-hidden rounded-[20px] border border-black/7 bg-white shadow-sm"><Link href={`/product/${deal.productId}`} className="block"><div className="relative aspect-square bg-[#F4F4F1]">{image ? <img src={image} alt={deal.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-[9px] font-bold text-black/25">No image</div>}<span className="absolute left-2 top-2 rounded-full bg-white/95 px-2 py-1 text-[7px] font-black uppercase">{isLive ? "Today's Deal" : `${WEEKDAY_LABELS[deal.day]} Deal`}</span></div></Link><div className="p-3"><h3 className="line-clamp-2 min-h-[36px] text-sm font-black">{item?.title || deal.title}</h3><div className="mt-2 flex items-baseline gap-2"><span className="font-[family-name:var(--font-mono)] text-sm font-black text-[#E1352B]">Rs. {display.toLocaleString()}</span>{normal > 0 && <span className="text-[9px] text-black/35 line-through">Rs. {normal.toLocaleString()}</span>}</div><button type="button" onClick={() => item && addItem({ id: item.id, name: item.title || deal.title, price: display, originalPrice: normal || display, image, imageUrl: image, dealDay: isLive ? deal.day : undefined })} className="mt-2 flex w-full items-center justify-center gap-1 rounded-xl bg-[#14140F] py-2 text-[8px] font-black text-white"><ShoppingCart size={11}/> Add to Cart</button></div></article>;
            })}
          </div>
        </div>
      )}
    </section>
  );
}
