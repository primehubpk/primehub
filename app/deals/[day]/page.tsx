'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { ArrowLeft, ChevronRight, ShoppingBag, Tag } from 'lucide-react';
import { db } from '@/lib/firebase';
import { useCartStore } from '@/lib/cartStore';
import { useSettings } from '@/lib/useSettings';
import type { Product, Weekday, WeeklyDeal } from '@/lib/types';

const DAYS: Array<{ key: Weekday; label: string }> = [
  { key: 'monday', label: 'Monday' }, { key: 'tuesday', label: 'Tuesday' }, { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' }, { key: 'friday', label: 'Friday' }, { key: 'saturday', label: 'Saturday' }, { key: 'sunday', label: 'Sunday' },
];
const DAY_ORDER = DAYS.map(({ key }) => key);
type DealStatus = 'live' | 'upcoming' | 'next-week';
type DealProduct = Product & { description?: string };

function pakistanWeekday(): Weekday {
  const value = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Karachi', weekday: 'long' }).format(new Date()).toLowerCase() as Weekday;
  return DAY_ORDER.includes(value) ? value : 'monday';
}
function statusForDay(day: Weekday, today: Weekday): DealStatus {
  const dayIndex = DAY_ORDER.indexOf(day); const todayIndex = DAY_ORDER.indexOf(today);
  if (dayIndex === todayIndex) return 'live';
  return dayIndex > todayIndex ? 'upcoming' : 'next-week';
}
function statusLabel(status: DealStatus, day: Weekday) {
  const dayLabel = DAYS.find((item) => item.key === day)?.label || 'Deal';
  return status === 'live' ? '🔴 LIVE TODAY' : `🔵 UPCOMING - ${dayLabel.toUpperCase()}`;
}
function statusStyles(status: DealStatus) {
  return status === 'live' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-sky-200 bg-sky-50 text-sky-700';
}
function imageOf(product: DealProduct | null, deal?: WeeklyDeal) { return product?.imageUrl || deal?.imageUrl || ''; }
function regularPriceOf(product: DealProduct | null, deal?: WeeklyDeal) {
  const productPrice = Number(product?.price || 0); return productPrice > 0 ? productPrice : Number(deal?.originalPrice || 0);
}
function pakistanTimeParts() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Karachi', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date());
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)])) as Record<string, number>;
}
function pakistanDateParts() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)])) as Record<string, number>;
}
function dayStartDeltaDays(target: Weekday, today: Weekday) {
  const delta = (DAY_ORDER.indexOf(target) - DAY_ORDER.indexOf(today) + DAY_ORDER.length) % DAY_ORDER.length;
  return delta === 0 ? 7 : delta;
}
function secondsUntilDayStart(target: Weekday, today: Weekday) {
  const now = pakistanTimeParts();
  const date = pakistanDateParts();
  const deltaDays = dayStartDeltaDays(target, today);
  const nowSeconds = now.hour * 3600 + now.minute * 60 + now.second;
  const secondsTodayRemaining = 24 * 3600 - nowSeconds;
  return Math.max(0, secondsTodayRemaining + Math.max(0, deltaDays - 1) * 24 * 3600);
}
function secondsUntilPakistanMidnight() {
  const now = pakistanTimeParts();
  return Math.max(0, 24 * 3600 - (now.hour * 3600 + now.minute * 60 + now.second));
}
function formatCountdown(seconds: number) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return days > 0
    ? `${String(days).padStart(2, '0')}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`
    : `${String(hours).padStart(2, '0')} : ${String(minutes).padStart(2, '0')} : ${String(secs).padStart(2, '0')}`;
}

export default function DayDealPage() {
  const params = useParams<{ day: string }>();
  const { settings, loading } = useSettings();
  const addItem = useCartStore((state) => state.addItem);
  const today = pakistanWeekday();
  const day = String(params?.day || '').toLowerCase() as Weekday;
  const valid = Boolean(DAYS.find((item) => item.key === day));
  const status = valid ? statusForDay(day, today) : 'next-week';
  const deal = useMemo(() => (settings.weeklyDeals || []).find((item) => item.day === day && item.productId), [settings.weeklyDeals, day]);
  const [product, setProduct] = useState<DealProduct | null>(null);
  const [products, setProducts] = useState<Record<string, DealProduct | null>>({});
  const [addingId, setAddingId] = useState<string | null>(null);
  const [productFailed, setProductFailed] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadProduct() {
      if (!deal?.productId) { setProduct(null); return; }
      try {
        const snap = await getDoc(doc(db, 'products', deal.productId));
        if (cancelled) return;
        if (!snap.exists()) { setProduct(null); setProductFailed(true); return; }
        setProduct({ id: snap.id, ...snap.data() } as DealProduct); setProductFailed(false);
      } catch { if (!cancelled) setProductFailed(true); }
    }
    loadProduct(); return () => { cancelled = true; };
  }, [deal?.productId]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'products'), (snapshot) => {
      const mapped: Record<string, DealProduct | null> = {};
      snapshot.forEach((item) => { mapped[item.id] = { id: item.id, ...item.data() } as DealProduct; });
      setProducts(mapped);
    }, () => setProducts({}));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const update = () => setCountdown(status === 'live' ? secondsUntilPakistanMidnight() : secondsUntilDayStart(day, today));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [status, day, today]);

  const label = DAYS.find((item) => item.key === day)?.label || 'Deal';
  const regularPrice = regularPriceOf(product, deal);
  const dealPrice = Number(deal?.dealPrice || 0);
  const discount = regularPrice > dealPrice && dealPrice > 0 ? Math.round(((regularPrice - dealPrice) / regularPrice) * 100) : 0;
  const live = status === 'live' && Boolean(deal?.active !== false && deal?.productId && product && !productFailed && dealPrice > 0);
  const title = product?.title || deal?.title || `${label} Deal`;
  const image = imageOf(product, deal);
  const available = Number(product?.stock ?? 0) > 0;
  const savings = Math.max(0, regularPrice - dealPrice);

  const addToCart = (itemDeal: WeeklyDeal, itemStatus: DealStatus) => {
    const itemProduct = itemDeal.productId === deal?.productId && product ? product : products[itemDeal.productId];
    if (!itemProduct || Number(itemProduct.stock ?? 0) <= 0) return;
    const regular = regularPriceOf(itemProduct, itemDeal);
    const configuredDealPrice = Number(itemDeal.dealPrice || 0);
    const price = itemStatus === 'live' && itemDeal.active !== false && configuredDealPrice > 0 ? configuredDealPrice : regular;
    if (price <= 0) return;
    const itemImage = imageOf(itemProduct, itemDeal);
    addItem({ id: itemProduct.id, name: itemProduct.title || itemDeal.title || `${itemDeal.day} Deal`, price, originalPrice: regular > price ? regular : Number(itemProduct.originalPrice || regular), image: itemImage || undefined, imageUrl: itemImage || undefined, ...(itemStatus === 'live' ? { dealDay: itemDeal.day } : {}) });
    setAddingId(itemDeal.id);
    window.setTimeout(() => setAddingId((current) => current === itemDeal.id ? null : current), 1200);
  };

  if (!valid) return <main className="min-h-screen bg-neutral-50 px-4 py-10 pb-28"><div className="mx-auto max-w-2xl rounded-[30px] bg-white p-10 text-center shadow-sm"><Tag className="mx-auto h-10 w-10 text-black/20" /><h1 className="mt-4 text-2xl font-black">Deal day not found</h1><Link href="/deals" className="mt-5 inline-flex rounded-full bg-[#14140F] px-5 py-3 text-xs font-black text-white">Back to Deals</Link></div></main>;
  if (loading) return <main className="min-h-screen bg-neutral-50 px-4 py-5 pb-28"><div className="mx-auto max-w-6xl"><div className="h-10 w-28 animate-pulse rounded-full bg-white" /><div className="mt-5 h-16 animate-pulse rounded-[24px] bg-white" /><div className="mt-5 grid gap-4 lg:grid-cols-[1.05fr_.95fr]"><div className="aspect-square animate-pulse rounded-[30px] bg-white" /><div className="min-h-[420px] animate-pulse rounded-[30px] bg-white" /></div></div></main>;

  const weeklyDeals = (settings.weeklyDeals || []).filter((item) => item.productId);

  return <main className="min-h-screen bg-neutral-50 pb-28">
    <div className="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-7">
      <div className="flex flex-wrap items-center gap-3"><Link href="/deals" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[10px] font-black shadow-sm"><ArrowLeft size={14} /> Back to Deals</Link><span className="text-[9px] font-black uppercase tracking-[0.22em] text-black/35">Weekly Deal • {label}</span></div>

      <header className="mt-5 rounded-[28px] bg-white p-5 shadow-sm md:p-7"><p className="text-[9px] font-black uppercase tracking-[0.25em] text-[#E1352B]">{label} Deal</p><h1 className="mt-1 text-3xl font-black tracking-tight md:text-5xl">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-black/50">{live ? 'Today’s special offer is live in Pakistan time.' : `This offer is scheduled for ${label}. The special price unlocks on ${label}.`}</p></header>

      <section className="mt-5 overflow-hidden rounded-[30px] border border-black/5 bg-white shadow-sm">
        <div className="grid lg:grid-cols-[1.05fr_.95fr]">
          <div className="relative aspect-square bg-[#F4F4F1] lg:aspect-auto lg:min-h-[560px]">{image ? <img src={image} alt={title} className="h-full w-full object-cover" /> : <div className="flex h-full min-h-[360px] items-center justify-center text-xs font-bold text-black/25">No product image</div>}<div className="absolute left-4 top-4 flex flex-wrap gap-2"><span className={`rounded-full border px-3 py-1.5 text-[9px] font-black ${statusStyles(status)}`}>{statusLabel(status, day)}</span>{discount > 0 && <span className="rounded-full bg-[#E1352B] px-3 py-1.5 text-[9px] font-black text-white">-{discount}% OFF</span>}</div></div>

          <div className="p-6 md:p-10">
            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#E1352B]">Purchase Offer</p>
            {live ? (
              <>
                <div className="mt-3 flex flex-wrap items-end gap-3"><span className="text-lg text-black/35 line-through">Rs. {regularPrice.toLocaleString()}</span><span className="font-[family-name:var(--font-mono)] text-4xl font-black text-[#E1352B]">Rs. {dealPrice.toLocaleString()}</span></div>
                {savings > 0 && <div className="mt-3 inline-flex rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-black text-emerald-700">YOU SAVE Rs. {savings.toLocaleString()} ({discount}% OFF)</div>}
                <div className="mt-5 rounded-2xl border border-black/8 bg-neutral-50 px-4 py-3"><p className="text-[9px] font-black uppercase tracking-[0.22em] text-black/40">Deal ends in</p><div className="mt-1 font-[family-name:var(--font-mono)] text-2xl font-black tracking-wide text-[#14140F]">{formatCountdown(countdown)}</div></div>
                <button type="button" disabled={!product || !available || dealPrice <= 0 || addingId === deal?.id} onClick={() => deal && addToCart(deal, 'live')} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#14140F] px-5 py-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-35"><ShoppingBag size={18} /> {addingId === deal?.id ? 'ADDED' : `BUY NOW - Rs. ${dealPrice.toLocaleString()}`}</button>
              </>
            ) : (
              <>
                <div className="mt-4 rounded-2xl bg-neutral-50 p-4"><p className="text-sm font-black text-[#14140F]">Upcoming {label} Deal Price: Rs. {dealPrice.toLocaleString()}</p><p className="mt-2 text-xs font-bold text-black/45">⏰ Unlocks in: {formatCountdown(countdown)}</p></div>
                <div className="mt-4 rounded-2xl bg-white p-1 ring-1 ring-black/5"><div className="flex items-center justify-between px-3 py-2 text-sm"><span className="font-bold text-black/55">Current Storefront Price</span><span className="font-black">Rs. {regularPrice.toLocaleString()}</span></div></div>
                <button type="button" disabled={!product || !available || regularPrice <= 0 || addingId === deal?.id} onClick={() => deal && addToCart(deal, status)} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#14140F] px-5 py-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-35"><ShoppingBag size={18} /> {addingId === deal?.id ? 'ADDED' : `ADD TO CART (REGULAR PRICE) — Rs. ${regularPrice.toLocaleString()}`}</button>
              </>
            )}
            {product && <Link href={`/product/${product.id}`} className="mt-3 inline-flex items-center gap-2 text-xs font-black text-black/45 hover:text-black">View Product <ChevronRight size={14} /></Link>}
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-[30px] bg-neutral-50 p-1"><div className="rounded-[28px] bg-white p-5 shadow-sm md:p-7"><div className="flex items-end justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[0.25em] text-[#E1352B]">Keep exploring</p><h2 className="mt-1 text-2xl font-black">EXPLORE WEEKLY DEALS</h2></div><Link href="/deals" className="text-[9px] font-black uppercase tracking-[0.18em] text-black/40">View all</Link></div>{!weeklyDeals.length ? <div className="mt-5 rounded-2xl border border-dashed border-black/10 bg-neutral-50 p-6 text-center"><p className="text-xs font-bold text-black/40">No weekly deals scheduled yet.</p></div> : <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{DAYS.map(({ key, label: itemLabel }) => { const itemDeal = weeklyDeals.find((item) => item.day === key); if (!itemDeal) return null; const itemProduct = products[itemDeal.productId] || null; const itemStatus = statusForDay(key, today); const itemRegular = regularPriceOf(itemProduct, itemDeal); const itemDealPrice = Number(itemDeal.dealPrice || 0); const itemDiscount = itemRegular > itemDealPrice && itemDealPrice > 0 ? Math.round(((itemRegular - itemDealPrice) / itemRegular) * 100) : 0; const itemImage = imageOf(itemProduct, itemDeal); const itemTitle = itemProduct?.title || itemDeal.title || `${itemLabel} Deal`; const itemAvailable = Boolean(itemProduct && Number(itemProduct.stock ?? 0) > 0 && itemRegular > 0); const itemButtonPrice = itemStatus === 'live' && itemDealPrice > 0 ? itemDealPrice : itemRegular; return <Link key={itemDeal.id} href={`/deals/${key}`} className="group overflow-hidden rounded-2xl border border-black/6 bg-white shadow-sm transition hover:-translate-y-0.5"><div className="relative h-44 bg-[#F4F4F1] sm:h-48">{itemImage ? <img src={itemImage} alt={itemTitle} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-[10px] font-bold text-black/25">No image</div>}<div className="absolute left-2 top-2 flex flex-wrap gap-1.5"><span className={`rounded-full border px-2 py-1 text-[8px] font-black ${statusStyles(itemStatus)}`}>{statusLabel(itemStatus, key)}</span>{itemDiscount > 0 && <span className="rounded-full bg-[#E1352B] px-2 py-1 text-[8px] font-black text-white">-{itemDiscount}%</span>}</div></div><div className="p-3"><p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#E1352B]">{itemLabel} Deal</p><h3 className="mt-1 line-clamp-2 min-h-[34px] text-sm font-black">{itemTitle}</h3><div className="mt-2 flex flex-wrap items-baseline gap-2"><span className="text-sm font-black text-[#E1352B]">Deal Rs. {itemDealPrice.toLocaleString()}</span><span className="text-[10px] font-bold text-black/35 line-through">Rs. {itemRegular.toLocaleString()}</span></div><button type="button" disabled={!itemAvailable || addingId === itemDeal.id} onClick={(event) => { event.preventDefault(); event.stopPropagation(); addToCart(itemDeal, itemStatus); }} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#14140F] px-2.5 py-2.5 text-[9px] font-black text-white disabled:opacity-35"><ShoppingBag size={13} /> {addingId === itemDeal.id ? 'ADDED' : itemStatus === 'live' ? `BUY NOW — Rs. ${itemButtonPrice.toLocaleString()}` : `ADD TO CART — Rs. ${itemButtonPrice.toLocaleString()}`}</button></div></Link>; })}</div>}</div></section>
    </div>
  </main>;
}
