'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, ShoppingCart } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useCartStore } from '@/lib/cartStore';
import { useSettings } from '@/lib/useSettings';
import type { Product, WeeklyDeal } from '@/lib/types';
import { WEEKDAY_LABELS, WEEKDAY_ORDER, dealTiming } from '@/lib/weeklyDealUtils';

export default function WeeklyDealProductExtras({ productId }: { productId: string }) {
  const { settings } = useSettings();
  const addItem = useCartStore((state) => state.addItem);
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [nowTick, setNowTick] = useState<number | null>(null);
  const [addedId, setAddedId] = useState<string | null>(null);

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
  const otherDeals = useMemo(() => deals.filter((deal) => deal.active !== false && deal.productId && deal.productId !== productId).sort((a, b) => WEEKDAY_ORDER.indexOf(a.day) - WEEKDAY_ORDER.indexOf(b.day)), [deals, productId]);
  if (!currentDeal || nowTick === null || otherDeals.length === 0) return null;

  const addToCart = (deal: WeeklyDeal) => {
    const item = products[deal.productId];
    if (!item || Number(item.stock ?? 0) <= 0) return;
    const normal = Number(item.price || deal.originalPrice || 0);
    const dealPrice = Number(deal.dealPrice || 0);
    const isLive = dealTiming(deal.day, new Date(nowTick)).isLive;
    const display = isLive ? dealPrice : normal;
    if (display <= 0) return;
    const image = item.imageUrl || deal.imageUrl || '';
    addItem({ id: item.id, name: item.title || deal.title, price: display, originalPrice: isLive ? Number(item.originalPrice || deal.originalPrice || display) : normal || display, image, imageUrl: image, dealDay: isLive ? deal.day : undefined });
    setAddedId(deal.id);
    window.setTimeout(() => setAddedId((current) => current === deal.id ? null : current), 1200);
  };

  return <section className="mx-auto max-w-5xl px-3 pb-8 md:px-5">
    <div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-[8px] font-black uppercase tracking-[0.2em] text-[#E1352B]">Keep browsing</p><h2 className="mt-0.5 text-xl font-black">More Weekly Deals</h2></div><Link href="/weekly-deals" className="text-[9px] font-black uppercase tracking-wider text-[#0F6A5F]">View all</Link></div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {otherDeals.map((deal: WeeklyDeal) => {
        const item = products[deal.productId];
        const image = item?.imageUrl || deal.imageUrl || '';
        const normal = Number(item?.price || deal.originalPrice || 0);
        const dealP = Number(deal.dealPrice || 0);
        const isLive = dealTiming(deal.day, new Date(nowTick)).isLive;
        const display = isLive && dealP > 0 ? dealP : normal;
        const inStock = Boolean(item && Number(item.stock ?? 0) > 0 && display > 0);
        return <article key={deal.id} className="overflow-hidden rounded-[20px] border border-black/7 bg-white shadow-sm"><Link href={`/product/${deal.productId}`} className="block"><div className="relative aspect-square bg-[#F4F4F1]">{image ? <img src={image} alt={deal.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-[9px] font-bold text-black/25">No image</div>}<span className="absolute left-2 top-2 rounded-full bg-white/95 px-2 py-1 text-[7px] font-black uppercase">{isLive ? "Today's Deal" : `${WEEKDAY_LABELS[deal.day]} Deal`}</span></div></Link><div className="p-3"><h3 className="line-clamp-2 min-h-[36px] text-sm font-black">{item?.title || deal.title}</h3><div className="mt-2 flex items-baseline gap-2"><span className="font-[family-name:var(--font-mono)] text-sm font-black text-[#E1352B]">Rs. {display.toLocaleString()}</span>{normal > display && <span className="text-[9px] text-black/35 line-through">Rs. {normal.toLocaleString()}</span>}</div><button type="button" disabled={!inStock || addedId === deal.id} onClick={() => addToCart(deal)} className="mt-2 flex w-full items-center justify-center gap-1 rounded-xl bg-[#14140F] py-2.5 text-[8px] font-black text-white disabled:opacity-40">{addedId === deal.id ? <><Check size={11}/> ADDED</> : <><ShoppingCart size={11}/> ADD TO CART</>}</button></div></article>;
      })}
    </div>
  </section>;
}
