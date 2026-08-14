'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { ArrowLeft, ShoppingBag, Sparkles, Tag } from 'lucide-react';
import { db } from '@/lib/firebase';
import { useCartStore } from '@/lib/cartStore';
import { useSettings } from '@/lib/useSettings';
import type { Product, Weekday, WeeklyDeal } from '@/lib/types';

const DAYS: Array<{ key: Weekday; label: string }> = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];
const DAY_ORDER = DAYS.map(({ key }) => key);

type DealStatus = 'live' | 'upcoming' | 'next-week';
type DealProduct = Product & { description?: string };

function pakistanWeekday(): Weekday {
  const value = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Karachi',
    weekday: 'long',
  }).format(new Date()).toLowerCase() as Weekday;
  return DAY_ORDER.includes(value) ? value : 'monday';
}

function statusForDay(day: Weekday, today: Weekday): DealStatus {
  const dayIndex = DAY_ORDER.indexOf(day);
  const todayIndex = DAY_ORDER.indexOf(today);
  if (dayIndex === todayIndex) return 'live';
  return dayIndex > todayIndex ? 'upcoming' : 'next-week';
}

function statusLabel(status: DealStatus) {
  if (status === 'live') return '🔴 LIVE TODAY';
  if (status === 'upcoming') return '🔵 UPCOMING';
  return '🔵 UPCOMING (NEXT WEEK)';
}

function statusStyles(status: DealStatus) {
  if (status === 'live') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  return 'bg-sky-50 text-sky-700 border-sky-200';
}

function imageOf(product: DealProduct | null, deal: WeeklyDeal) {
  return product?.imageUrl || deal.imageUrl || '';
}

function regularPriceOf(product: DealProduct | null, deal: WeeklyDeal) {
  const productPrice = Number(product?.price || 0);
  return productPrice > 0 ? productPrice : Number(deal.originalPrice || 0);
}

export default function DealsPage() {
  const { settings, loading } = useSettings();
  const addItem = useCartStore((state) => state.addItem);
  const today = pakistanWeekday();
  const [products, setProducts] = useState<Record<string, DealProduct | null>>({});
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'products'),
      (snapshot) => {
        const mapped: Record<string, DealProduct | null> = {};
        snapshot.forEach((item) => {
          mapped[item.id] = { id: item.id, ...item.data() } as DealProduct;
        });
        setProducts(mapped);
      },
      () => setProducts({}),
    );
    return () => unsubscribe();
  }, []);

  const weeklyDeals = useMemo(() => (settings.weeklyDeals || []).filter((deal) => deal.productId), [settings.weeklyDeals]);

  const addToCart = async (deal: WeeklyDeal, status: DealStatus) => {
    const product = products[deal.productId];
    if (!product || Number(product.stock ?? 0) <= 0) return;
    const regularPrice = regularPriceOf(product, deal);
    const dealPrice = Number(deal.dealPrice || 0);
    const price = status === 'live' && deal.active !== false && dealPrice > 0 ? dealPrice : regularPrice;
    if (price <= 0) return;
    addItem({
      id: product.id,
      name: product.title || deal.title || `${deal.day} Deal`,
      price,
      originalPrice: regularPrice > price ? regularPrice : Number(product.originalPrice || regularPrice),
      image: imageOf(product, deal) || undefined,
      imageUrl: imageOf(product, deal) || undefined,
      ...(status === 'live' ? { dealDay: deal.day } : {}),
    });
    setAddingId(deal.id);
    window.setTimeout(() => setAddingId((current) => current === deal.id ? null : current), 1200);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-50 pb-28">
        <div className="mx-auto max-w-6xl px-4 py-5 md:px-6">
          <div className="h-10 w-28 animate-pulse rounded-full bg-white" />
          <div className="mt-5 h-28 animate-pulse rounded-[30px] bg-black/5" />
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 7 }).map((_, index) => <div key={index} className="h-[390px] animate-pulse rounded-[28px] bg-white" />)}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50 pb-28">
      <div className="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-7">
        <Link href="/" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[10px] font-black shadow-sm">
          <ArrowLeft size={14} /> Back to Home
        </Link>

        <header className="mt-5 overflow-hidden rounded-[30px] bg-white p-6 shadow-sm md:p-8">
          <div className="flex items-center gap-2 text-[#E1352B]"><Sparkles size={18} /><span className="text-[9px] font-black uppercase tracking-[0.24em]">PrimeHub Weekly Deals</span></div>
          <h1 className="mt-2 text-3xl font-black tracking-tight md:text-5xl">7 Days. 7 Deals.</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-black/50">Every deal repeats automatically each week using Pakistan time. Past days never expire — they roll forward to their next occurrence.</p>
        </header>

        {!weeklyDeals.length ? (
          <section className="mt-5 rounded-[30px] bg-white p-10 text-center shadow-sm">
            <Tag className="mx-auto h-10 w-10 text-black/20" />
            <h2 className="mt-4 text-2xl font-black">No Weekly Deals Scheduled</h2>
            <p className="mt-2 text-xs text-black/45">Add real products and special prices from Admin → Deals.</p>
          </section>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {DAYS.map(({ key, label }) => {
              const deal = weeklyDeals.find((item) => item.day === key);
              if (!deal) return (
                <article key={key} className="rounded-[28px] border border-dashed border-black/10 bg-white p-5 text-center shadow-sm">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-black/35">{label} Deal</p>
                  <h2 className="mt-3 text-lg font-black">No deal scheduled</h2>
                  <p className="mt-1 text-xs text-black/40">Admin has not assigned a product yet.</p>
                </article>
              );

              const product = products[deal.productId] || null;
              const status = statusForDay(key, today);
              const regularPrice = regularPriceOf(product, deal);
              const dealPrice = Number(deal.dealPrice || 0);
              const discount = regularPrice > dealPrice && dealPrice > 0 ? Math.round(((regularPrice - dealPrice) / regularPrice) * 100) : 0;
              const image = imageOf(product, deal);
              const title = product?.title || deal.title || `${label} Deal`;
              const stock = Number(product?.stock ?? 0);
              const canBuy = Boolean(product && stock > 0 && regularPrice > 0);

              return (
                <article key={deal.id} className="group overflow-hidden rounded-[28px] border border-black/5 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.06)] transition hover:-translate-y-0.5">
                  <div className="relative aspect-square bg-[#F4F4F1]">
                    {image ? <img src={image} alt={title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs font-bold text-black/25">No product image</div>}
                    <div className="absolute left-3 top-3 right-3 flex items-start justify-between gap-2">
                      <span className={`rounded-full border px-2.5 py-1.5 text-[8px] font-black uppercase tracking-wide ${statusStyles(status)}`}>{statusLabel(status)}</span>
                      {discount > 0 && <span className="rounded-full bg-[#E1352B] px-2.5 py-1.5 text-[9px] font-black text-white">-{discount}% OFF</span>}
                    </div>
                  </div>

                  <div className="p-4">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#E1352B]">{label} Deal</p>
                    <h2 className="mt-1.5 line-clamp-2 min-h-[44px] text-lg font-black">{title}</h2>
                    <div className="mt-3 flex items-end gap-2">
                      <span className="font-[family-name:var(--font-mono)] text-xl font-black text-[#E1352B]">Rs. {dealPrice > 0 ? dealPrice.toLocaleString() : '—'}</span>
                      {regularPrice > dealPrice && <span className="pb-0.5 text-xs text-black/35 line-through">Rs. {regularPrice.toLocaleString()}</span>}
                    </div>
                    <p className="mt-1 text-[10px] text-black/40">{status === 'live' ? 'Special price active today.' : status === 'upcoming' ? 'Special price unlocks on this day.' : 'Special price returns next week.'}</p>

                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        disabled={!canBuy || addingId === deal.id}
                        onClick={() => addToCart(deal, status)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#14140F] px-3 py-3 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        <ShoppingBag size={14} />
                        {addingId === deal.id ? 'ADDED' : status === 'live' ? 'ADD TO CART' : 'SHOP NOW'}
                      </button>
                      <Link href={`/deals/${key}`} className="inline-flex items-center justify-center rounded-xl border border-black/10 px-3 py-3 text-[10px] font-black">
                        VIEW
                      </Link>
                    </div>
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
