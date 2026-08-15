'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, ShoppingCart, Sparkles } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useCartStore } from '@/lib/cartStore';
import { useSettings } from '@/lib/useSettings';
import type { Product, Weekday, WeeklyDeal } from '@/lib/types';

const DAYS: Weekday[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const LABELS: Record<Weekday, string> = {
  sunday: 'Sunday', monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday',
};

function todayInPakistan(): Weekday {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Karachi', weekday: 'long' }).format(new Date()).toLowerCase() as Weekday;
}

function imageOf(product: Product | undefined, deal: WeeklyDeal) {
  return product?.imageUrl || deal.imageUrl || '';
}

export default function WeeklyDealsPage() {
  const { settings, loading } = useSettings();
  const addItem = useCartStore((state) => state.addItem);
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [addedId, setAddedId] = useState<string | null>(null);
  const today = todayInPakistan();

  useEffect(() => {
    return onSnapshot(collection(db, 'products'), (snapshot) => {
      const next: Record<string, Product> = {};
      snapshot.forEach((doc) => { next[doc.id] = { id: doc.id, ...doc.data() } as Product; });
      setProducts(next);
    }, () => setProducts({}));
  }, []);

  const deals = useMemo(() => {
    const source = (settings.weeklyDeals || []).filter((deal) => deal.productId);
    return [...source].sort((a, b) => {
      const aToday = a.day === today ? 0 : 1;
      const bToday = b.day === today ? 0 : 1;
      if (aToday !== bToday) return aToday - bToday;
      return DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
    });
  }, [settings.weeklyDeals, today]);

  const addToCart = (deal: WeeklyDeal) => {
    const product = products[deal.productId];
    if (!product || Number(product.stock ?? 0) <= 0) return;
    const regularPrice = Number(product.price || deal.originalPrice || 0);
    const dealPrice = Number(deal.dealPrice || 0);
    const isLiveToday = deal.day === today && deal.active !== false && dealPrice > 0;
    const price = isLiveToday ? dealPrice : regularPrice;
    if (price <= 0) return;
    const image = imageOf(product, deal);
    addItem({
      id: product.id,
      name: product.title || deal.title || `${LABELS[deal.day]} Deal`,
      price,
      originalPrice: isLiveToday ? Number(product.originalPrice || deal.originalPrice || price) : regularPrice,
      image: image || undefined,
      imageUrl: image || undefined,
      dealDay: isLiveToday ? deal.day : undefined,
    });
    setAddedId(deal.id);
    window.setTimeout(() => setAddedId((current) => current === deal.id ? null : current), 1200);
  };

  if (loading) {
    return <main className="min-h-screen bg-neutral-50 pb-28"><div className="mx-auto max-w-6xl px-4 py-8"><div className="h-10 w-28 animate-pulse rounded-full bg-white" /><div className="mt-6 h-32 animate-pulse rounded-[30px] bg-black/5" /><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 7 }).map((_, i) => <div key={i} className="h-[390px] animate-pulse rounded-[28px] bg-white" />)}</div></div></main>;
  }

  return (
    <main className="min-h-screen bg-neutral-50 pb-28">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
        <Link href="/" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[10px] font-black shadow-sm"><ArrowLeft size={14} /> Back to Home</Link>
        <header className="mt-5 overflow-hidden rounded-[30px] bg-white p-6 shadow-sm md:p-8">
          <div className="flex items-center gap-2 text-[#0F6A5F]"><CalendarDays size={18} /><span className="text-[9px] font-black uppercase tracking-[0.24em]">PrimeHub Weekly Deals</span></div>
          <h1 className="mt-2 text-3xl font-black tracking-tight md:text-5xl">7 Days. 7 Deals.</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-black/50">Today’s live deal appears first. Only today’s active deal uses the special deal price; all other days use the product’s normal price until their day becomes live.</p>
        </header>

        {!deals.length ? (
          <section className="mt-6 rounded-[30px] bg-white p-10 text-center shadow-sm"><Sparkles className="mx-auto h-10 w-10 text-black/20" /><h2 className="mt-4 text-2xl font-black">No Weekly Deals Scheduled</h2><p className="mt-2 text-xs text-black/45">Add weekly deals from the admin panel.</p></section>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {deals.map((deal) => {
              const product = products[deal.productId];
              const title = product?.title || deal.title || `${LABELS[deal.day]} Deal`;
              const image = imageOf(product, deal);
              const regularPrice = Number(product?.price || deal.originalPrice || 0);
              const dealPrice = Number(deal.dealPrice || 0);
              const isToday = deal.day === today;
              const isLiveToday = isToday && deal.active !== false && dealPrice > 0;
              const price = isLiveToday ? dealPrice : regularPrice;
              const original = isLiveToday ? Number(product?.originalPrice || deal.originalPrice || price) : regularPrice;
              const discount = isLiveToday && original > price && price > 0 ? Math.round(((original - price) / original) * 100) : 0;
              const inStock = Boolean(product && Number(product.stock ?? 0) > 0 && price > 0);
              return (
                <article key={deal.id} className={`overflow-hidden rounded-[28px] border bg-white shadow-[0_12px_40px_rgba(0,0,0,0.06)] ${isLiveToday ? 'border-emerald-300 ring-2 ring-emerald-100' : 'border-black/5'}`}>
                  <Link href={`/product/${deal.productId}`} aria-label={`View ${title}`} className="group block">
                    <div className="relative aspect-square overflow-hidden bg-[#F4F4F1]">
                      {image ? <img src={image} alt={title} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" /> : <div className="flex h-full items-center justify-center text-xs font-bold text-black/25">No product image</div>}
                      <div className="absolute left-3 right-3 top-3 flex items-center justify-between gap-2"><span className={`rounded-full px-2.5 py-1.5 text-[8px] font-black uppercase tracking-wide ${isLiveToday ? 'bg-emerald-500 text-white' : 'bg-white/95 text-black/70'}`}>{isLiveToday ? "TODAY'S DEAL" : `${LABELS[deal.day]} DEAL`}</span>{discount > 0 && <span className="rounded-full bg-[#E1352B] px-2.5 py-1.5 text-[9px] font-black text-white">-{discount}% OFF</span>}</div>
                    </div>
                  </Link>
                  <div className="p-4">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#E1352B]">{LABELS[deal.day]} Deal</p>
                    <h2 className="mt-1.5 line-clamp-2 min-h-[44px] text-lg font-black">{title}</h2>
                    <div className="mt-3 flex items-end gap-2"><span className="font-[family-name:var(--font-mono)] text-xl font-black text-[#E1352B]">Rs. {price.toLocaleString()}</span>{isLiveToday && original > price && <span className="pb-0.5 text-xs text-black/35 line-through">Rs. {original.toLocaleString()}</span>}</div>
                    <button type="button" disabled={!inStock || addedId === deal.id} onClick={() => addToCart(deal)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#14140F] px-3 py-3 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:opacity-35"><ShoppingCart size={14} />{addedId === deal.id ? 'ADDED TO CART' : 'ADD TO CART'}</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
