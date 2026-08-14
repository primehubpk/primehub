'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { ArrowLeft, ChevronRight, ShoppingBag, Tag } from 'lucide-react';
import { db } from '@/lib/firebase';
import { useCartStore } from '@/lib/cartStore';
import { useSettings } from '@/lib/useSettings';
import type { Product, Weekday } from '@/lib/types';

const DAYS: Record<Weekday, string> = {
  sunday: 'Sunday', monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday',
};
const DAY_ORDER: Weekday[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
type DealStatus = 'live' | 'upcoming' | 'next-week';
type DealProduct = Product & { description?: string };

function pakistanWeekday(): Weekday {
  const value = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Karachi', weekday: 'long' }).format(new Date()).toLowerCase() as Weekday;
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

export default function DayDealPage() {
  const params = useParams<{ day: string }>();
  const { settings, loading } = useSettings();
  const addItem = useCartStore((state) => state.addItem);
  const day = String(params?.day || '').toLowerCase() as Weekday;
  const valid = Boolean(DAYS[day]);
  const today = pakistanWeekday();
  const status = valid ? statusForDay(day, today) : 'next-week';
  const deal = useMemo(() => (settings.weeklyDeals || []).find((item) => item.day === day && item.productId), [settings.weeklyDeals, day]);
  const [product, setProduct] = useState<DealProduct | null>(null);
  const [productFailed, setProductFailed] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadProduct() {
      if (!deal?.productId) { setProduct(null); return; }
      try {
        const snap = await getDoc(doc(db, 'products', deal.productId));
        if (cancelled) return;
        if (!snap.exists()) { setProduct(null); setProductFailed(true); return; }
        setProduct({ id: snap.id, ...snap.data() } as DealProduct);
        setProductFailed(false);
      } catch {
        if (!cancelled) setProductFailed(true);
      }
    }
    loadProduct();
    return () => { cancelled = true; };
  }, [deal?.productId]);

  const regularPrice = Number(product?.price || deal?.originalPrice || 0);
  const dealPrice = Number(deal?.dealPrice || 0);
  const discount = regularPrice > dealPrice && dealPrice > 0 ? Math.round(((regularPrice - dealPrice) / regularPrice) * 100) : 0;
  const live = status === 'live' && Boolean(deal?.active !== false && deal?.productId && product && !productFailed && dealPrice > 0);
  const title = product?.title || deal?.title || `${DAYS[day] || 'Day'} Deal`;
  const image = product?.imageUrl || deal?.imageUrl || '';
  const available = Number(product?.stock ?? 0) > 0;

  const addToCart = () => {
    if (!product || !available || regularPrice <= 0) return;
    const price = live ? dealPrice : regularPrice;
    addItem({
      id: product.id,
      name: title,
      price,
      originalPrice: regularPrice > price ? regularPrice : Number(product.originalPrice || regularPrice),
      image: image || undefined,
      imageUrl: image || undefined,
      ...(live ? { dealDay: day } : {}),
    });
    setAdding(true);
    window.setTimeout(() => setAdding(false), 1000);
  };

  if (!valid) return <main className="min-h-screen bg-neutral-50 px-4 py-10"><div className="mx-auto max-w-2xl rounded-[32px] bg-white p-10 text-center shadow-sm"><Tag className="mx-auto h-10 w-10 text-black/20"/><h1 className="mt-4 text-2xl font-black">Deal day not found</h1><Link href="/deals" className="mt-5 inline-flex rounded-full bg-[#14140F] px-5 py-3 text-xs font-black text-white">Back to Deals</Link></div></main>;
  if (loading) return <main className="min-h-screen bg-neutral-50 px-4 py-5"><div className="mx-auto max-w-6xl"><div className="h-10 w-28 animate-pulse rounded-full bg-white"/><div className="mt-5 h-24 animate-pulse rounded-[30px] bg-black/5"/><div className="mt-5 grid gap-4 lg:grid-cols-2"><div className="aspect-square animate-pulse rounded-[30px] bg-black/5"/><div className="min-h-[420px] animate-pulse rounded-[30px] bg-white"/></div></div></main>;

  return (
    <main className="min-h-screen bg-neutral-50 pb-28">
      <div className="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-7">
        <div className="flex items-center justify-between gap-3">
          <Link href="/deals" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[10px] font-black shadow-sm"><ArrowLeft size={14}/> All Deals</Link>
          <span className={`rounded-full border px-3 py-1.5 text-[8px] font-black uppercase ${live ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-sky-200 bg-sky-50 text-sky-700'}`}>{statusLabel(status)}</span>
        </div>

        <section className="mt-5 overflow-hidden rounded-[30px] bg-white shadow-sm">
          <div className="grid lg:grid-cols-[1.05fr_.95fr]">
            <div className="relative aspect-square bg-[#F4F4F1] lg:aspect-auto lg:min-h-[560px]">
              {image ? <img src={image} alt={title} className="h-full w-full object-cover"/> : <div className="flex h-full min-h-[360px] items-center justify-center text-xs font-bold text-black/25">No product image</div>}
              <div className="absolute left-4 top-4 flex gap-2">{discount > 0 && <span className="rounded-full bg-[#E1352B] px-3 py-1.5 text-[9px] font-black text-white">-{discount}% OFF</span>}<span className={`rounded-full border px-3 py-1.5 text-[9px] font-black ${live ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-sky-200 bg-sky-50 text-sky-700'}`}>{statusLabel(status)}</span></div>
            </div>
            <div className="flex flex-col justify-center p-6 md:p-10">
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#E1352B]">{DAYS[day]} Deal</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">{title}</h1>
              <div className="mt-6 flex items-end gap-3"><span className={`font-[family-name:var(--font-mono)] text-3xl font-black ${live ? 'text-[#E1352B]' : 'text-[#14140F]'}`}>Rs. {(live ? dealPrice : regularPrice).toLocaleString()}</span>{regularPrice > 0 && dealPrice > 0 && regularPrice > dealPrice && <span className="pb-1 text-sm text-black/35 line-through">Rs. {regularPrice.toLocaleString()}</span>}</div>
              <p className="mt-2 text-xs leading-5 text-black/45">{live ? 'Special deal price is active today in Pakistan time.' : status === 'upcoming' ? `Special price unlocks on ${DAYS[day]}. You can preview this product until then.` : `This deal repeats next ${DAYS[day]}. The special price will return automatically next week.`}</p>
              {deal?.productId && product ? <div className="mt-6 flex flex-wrap gap-2"><button type="button" onClick={addToCart} disabled={!available || adding} className="inline-flex items-center gap-2 rounded-xl bg-[#14140F] px-5 py-3 text-xs font-black text-white disabled:opacity-35"><ShoppingBag size={15}/>{adding ? 'ADDED' : live ? 'ADD TO CART' : 'SHOP NOW'}</button><Link href={`/product/${product.id}`} className="inline-flex items-center gap-2 rounded-xl border border-black/10 px-5 py-3 text-xs font-black">View Product <ChevronRight size={15}/></Link></div> : <div className="mt-6 rounded-2xl bg-[#F4F4F1] p-4 text-xs font-semibold text-black/50">This weekly slot is not connected to a live product record.</div>}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
