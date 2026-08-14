'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { ArrowLeft, Check, ChevronRight, LockKeyhole, ShoppingBag, Sparkles, Store, Tag, Truck, Zap } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { db } from '@/lib/firebase';
import { useCartStore } from '@/lib/cartStore';
import { useSettings } from '@/lib/useSettings';
import type { Product, Weekday } from '@/lib/types';
import DealCelebration from '@/components/DealCelebration';
import DealCountdown from '@/components/DealCountdown';

const DAYS: Record<Weekday, string> = {
  sunday: 'Sunday', monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday',
};
const DAY_ORDER: Weekday[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
type DealStatus = 'live' | 'ended' | 'upcoming';
type DealProduct = Product & { description?: string };

function pakistanWeekday(): Weekday {
  const value = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Karachi', weekday: 'long' }).format(new Date()).toLowerCase();
  return (DAY_ORDER.includes(value as Weekday) ? value : 'sunday') as Weekday;
}
function pakistanDateParts() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Karachi', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(new Date());
  return { year: Number(parts.find((part) => part.type === 'year')?.value), month: Number(parts.find((part) => part.type === 'month')?.value), day: Number(parts.find((part) => part.type === 'day')?.value) };
}
function pakistanMidnightISO(daysFromToday = 1) {
  const { year, month, day } = pakistanDateParts();
  return new Date(Date.UTC(year, month - 1, day + daysFromToday) - 5 * 60 * 60 * 1000).toISOString();
}
function nextDealUnlockISO(day: Weekday, today: Weekday) {
  const todayIndex = DAY_ORDER.indexOf(today); const targetIndex = DAY_ORDER.indexOf(day);
  const delta = (targetIndex - todayIndex + DAY_ORDER.length) % DAY_ORDER.length;
  return pakistanMidnightISO(delta === 0 ? 1 : delta);
}
function statusForDay(day: Weekday, today: Weekday): DealStatus {
  const selectedIndex = DAY_ORDER.indexOf(day); const todayIndex = DAY_ORDER.indexOf(today);
  if (selectedIndex === todayIndex) return 'live';
  return selectedIndex > todayIndex ? 'upcoming' : 'ended';
}
function statusLabel(status: DealStatus) { return status === 'live' ? 'LIVE' : status === 'upcoming' ? 'COMING SOON' : 'ENDED'; }
function statusClass(status: DealStatus) {
  if (status === 'live') return 'border-emerald-500/30 bg-emerald-50 text-emerald-700';
  if (status === 'upcoming') return 'border-sky-500/20 bg-sky-50 text-sky-700';
  return 'border-black/8 bg-black/[0.03] text-black/45';
}

export default function DayDealPage() {
  const params = useParams<{ day: string }>();
  const router = useRouter();
  const { settings, loading } = useSettings();
  const addItem = useCartStore((state) => state.addItem);
  const day = String(params?.day || '').toLowerCase() as Weekday;
  const valid = Boolean(DAYS[day]);
  const today = pakistanWeekday();
  const status = valid ? statusForDay(day, today) : 'ended';
  const deal = useMemo(() => (settings.weeklyDeals || []).find((item) => item.day === day && item.productId), [settings.weeklyDeals, day]);
  const [product, setProduct] = useState<DealProduct | null>(null);
  const [weeklyProducts, setWeeklyProducts] = useState<Partial<Record<Weekday, DealProduct | null>>>({});
  const [productLoading, setProductLoading] = useState(false);
  const [productFailed, setProductFailed] = useState(false);
  const [weeklyProductsLoading, setWeeklyProductsLoading] = useState(false);
  const [imageErrors, setImageErrors] = useState<Partial<Record<Weekday, boolean>>>({});
  const [weeklyAddedId, setWeeklyAddedId] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => setExpired(false), [day]);
  useEffect(() => {
    let cancelled = false;
    async function loadProduct() {
      if (!deal?.productId) { setProduct(null); return; }
      setProductLoading(true); setProductFailed(false);
      try {
        const snap = await getDoc(doc(db, 'products', deal.productId));
        if (cancelled) return;
        if (!snap.exists()) { setProduct(null); setProductFailed(true); }
        else setProduct({ id: snap.id, ...snap.data() } as DealProduct);
      } catch { if (!cancelled) setProductFailed(true); }
      finally { if (!cancelled) setProductLoading(false); }
    }
    loadProduct(); return () => { cancelled = true; };
  }, [deal?.productId]);
  useEffect(() => {
    let cancelled = false;
    async function loadWeeklyProducts() {
      const assigned = (settings.weeklyDeals || []).filter((item) => item.productId);
      if (!assigned.length) { setWeeklyProducts({}); return; }
      setWeeklyProductsLoading(true);
      const entries = await Promise.all(assigned.map(async (item) => {
        try {
          const snap = await getDoc(doc(db, 'products', item.productId));
          return [item.day, snap.exists() ? ({ id: snap.id, ...snap.data() } as DealProduct) : null] as const;
        } catch { return [item.day, null] as const; }
      }));
      if (!cancelled) { setWeeklyProducts(Object.fromEntries(entries)); setWeeklyProductsLoading(false); }
    }
    loadWeeklyProducts(); return () => { cancelled = true; };
  }, [settings.weeklyDeals]);

  const live = status === 'live' && Boolean(deal?.productId && product && !productFailed) && deal?.active !== false && Number(deal?.dealPrice) > 0 && !expired;
  const scheduled = Boolean(deal?.productId && product && !productFailed);
  const stock = Number(product?.stock ?? 0);
  const available = stock > 0;
  const regularPrice = product ? Number(product.price || 0) : 0;
  const configuredDealPrice = Number(deal?.dealPrice || 0);
  const displayedPrice = live ? configuredDealPrice : regularPrice;
  const compareAtPrice = product ? Number(product.originalPrice || 0) : 0;
  const savings = regularPrice > configuredDealPrice ? regularPrice - configuredDealPrice : 0;
  const discount = savings > 0 && regularPrice > 0 ? Math.round((savings / regularPrice) * 100) : 0;
  const title = product?.title || deal?.title || `${DAYS[day]} Deal`;
  const image = product?.imageUrl || '';
  const liveCountdownTarget = useMemo(() => pakistanMidnightISO(1), []);
  const upcomingCountdownTarget = useMemo(() => nextDealUnlockISO(day, today), [day, today]);

  const addCurrentProduct = () => {
    if (!product || !scheduled || !available || regularPrice <= 0) return;
    const price = live && configuredDealPrice > 0 ? configuredDealPrice : regularPrice;
    addItem({ id: product.id, name: title, price, originalPrice: compareAtPrice > price ? compareAtPrice : regularPrice, image: image || undefined, imageUrl: image || undefined, ...(live ? { dealDay: day } : {}) });
  };
  const buyNow = () => {
    if (!product || !live || !available || configuredDealPrice <= 0) return;
    addItem({ id: product.id, name: title, price: configuredDealPrice, originalPrice: compareAtPrice > configuredDealPrice ? compareAtPrice : regularPrice, image: image || undefined, imageUrl: image || undefined, dealDay: day });
    router.push('/checkout');
  };
  const addWeeklyProduct = (itemDay: Weekday) => {
    const itemStatus = statusForDay(itemDay, today);
    const dealItem = (settings.weeklyDeals || []).find((item) => item.day === itemDay && item.productId);
    const itemProduct = weeklyProducts[itemDay];
    if (!dealItem || !itemProduct) return;
    const itemStock = Number(itemProduct.stock ?? 0);
    const regular = Number(itemProduct.price || 0);
    const dealPrice = Number(dealItem.dealPrice || 0);
    if (itemStock <= 0 || regular <= 0) return;
    const price = itemStatus === 'live' && dealPrice > 0 ? dealPrice : regular;
    addItem({ id: itemProduct.id, name: itemProduct.title || `${DAYS[itemDay]} Deal`, price, originalPrice: Number(itemProduct.originalPrice || 0) > price ? Number(itemProduct.originalPrice) : regular, image: itemProduct.imageUrl || undefined, imageUrl: itemProduct.imageUrl || undefined, ...(itemStatus === 'live' ? { dealDay: itemDay } : {}) });
    setWeeklyAddedId(itemProduct.id);
    window.setTimeout(() => setWeeklyAddedId((current) => current === itemProduct.id ? null : current), 1400);
  };

  if (!valid) return <main className="min-h-screen bg-[#F4F4F1] px-4 py-10"><div className="mx-auto max-w-2xl rounded-[32px] bg-white p-10 text-center shadow-sm"><Tag className="mx-auto h-10 w-10 text-black/20" /><h1 className="mt-4 text-2xl font-black">Deal day not found</h1><Link href="/" className="mt-5 inline-flex rounded-full bg-[#14140F] px-5 py-3 text-xs font-black text-white">Back Home</Link></div></main>;
  if (loading || productLoading) return <main className="min-h-screen bg-[#F4F4F1] px-4 pb-28 pt-5"><div className="mx-auto max-w-6xl"><div className="h-10 w-28 animate-pulse rounded-full bg-white" /><div className="mt-4 h-36 animate-pulse rounded-[32px] bg-[#14140F]/10" /><div className="mt-4 grid gap-4 lg:grid-cols-[1.05fr_.95fr]"><div className="aspect-square animate-pulse rounded-[32px] bg-black/5 lg:aspect-auto lg:min-h-[560px]" /><div className="min-h-[560px] animate-pulse rounded-[32px] bg-white" /></div></div></main>;

  return <main className={`min-h-screen overflow-x-hidden pb-28 ${live ? 'bg-[#0E100F]' : 'bg-[#F4F4F1]'}`}>
    {live && <DealCelebration />}
    <div className="mx-auto max-w-6xl px-4 py-4 md:px-6 md:py-6">
      <div className="flex items-center justify-between"><Link href="/" className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[10px] font-black shadow-sm ${live ? 'bg-white/10 text-white backdrop-blur' : 'bg-white text-[#14140F]'}`}><ArrowLeft size={14} /> Back to Home</Link><span className={`hidden text-[9px] font-black uppercase tracking-[0.25em] sm:block ${live ? 'text-white/35' : 'text-black/35'}`}>PrimeHub Live Deal Experience</span></div>
      <section className={`relative mt-4 overflow-hidden rounded-[32px] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.16)] md:p-9 ${live ? 'border border-emerald-300/20 bg-[radial-gradient(circle_at_80%_20%,rgba(16,185,129,.18),transparent_30%),radial-gradient(circle_at_20%_80%,rgba(225,53,43,.14),transparent_35%),#111512] text-white' : status === 'upcoming' ? 'bg-[#10202A] text-white' : 'bg-[#20201C] text-white'}`}>
        {live && <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,.05)_45%,transparent_70%)]" />}
        <div className="relative"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-wider shadow-lg ${live ? 'bg-[#E1352B] text-white shadow-red-500/30' : 'bg-white/10 text-white/70'}`}>{live ? 'LIVE NOW' : status === 'upcoming' ? 'COMING SOON' : 'DEAL ENDED'}</span>{live && <span className="rounded-full bg-[#FFB020] px-3 py-1.5 text-[9px] font-black text-[#14140F] shadow-lg">TODAY ONLY</span>}</div><p className="mt-5 text-[9px] font-black uppercase tracking-[0.3em] text-[#FFB020]">One day special offer</p><h1 className="mt-2 text-3xl font-black tracking-tight md:text-6xl">{DAYS[day]} Big Deal</h1><p className="mt-2 max-w-2xl text-xs leading-5 text-white/55 md:text-sm">{live ? 'A luxury flash-sale event is live right now. The special price expires at midnight Pakistan time.' : status === 'upcoming' ? `The ${DAYS[day]} event is scheduled next. Its special price stays locked until the event opens.` : `The ${DAYS[day]} event has ended. The product is shown at its regular storefront price.`}</p></div>
      </section>
      {!scheduled ? <section className="mt-4 rounded-[32px] border border-black/6 bg-white p-8 text-center shadow-sm md:p-12"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-black/5"><Tag size={25} className="text-black/30" /></div><p className="mt-5 text-[9px] font-black uppercase tracking-[0.25em] text-[#E1352B]">No scheduled product</p><h2 className="mt-2 text-2xl font-black">No Deal Scheduled For This Day</h2><p className="mx-auto mt-2 max-w-md text-xs leading-5 text-black/45">The selected day has no product assigned in the Admin Panel, so no invented deal content is shown.</p><Link href={`/deals/${today}`} className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#14140F] px-5 py-3 text-xs font-black text-white">View Today's Deal <ChevronRight size={15} /></Link></section> : <section className={`relative mt-4 overflow-hidden rounded-[32px] border shadow-sm ${live ? 'border-emerald-300/20 bg-white shadow-[0_30px_100px_rgba(16,185,129,.14)]' : 'border-black/6 bg-white'}`}>
        {live && <div className="pointer-events-none absolute -inset-20 bg-[radial-gradient(circle_at_10%_20%,rgba(225,53,43,.12),transparent_18%),radial-gradient(circle_at_90%_30%,rgba(255,176,32,.14),transparent_20%),radial-gradient(circle_at_55%_100%,rgba(16,185,129,.12),transparent_25%)] blur-2xl" />}
        <div className="relative grid lg:grid-cols-[1.05fr_.95fr]">
          <div className="relative min-h-[360px] bg-[#EEEDE7] lg:min-h-[610px]">{image ? <img src={image} alt={title} className="absolute inset-0 h-full w-full object-cover" /> : <div className="flex h-full min-h-[360px] items-center justify-center text-xs font-bold text-black/25">No product image</div>}<div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" /><div className="absolute left-4 top-4 flex flex-wrap gap-2">{live && <span className="flex items-center gap-1.5 rounded-full bg-[#E1352B] px-3 py-1.5 text-[9px] font-black text-white shadow-lg"><Zap size={11} fill="currentColor" /> LIVE NOW</span>}{live && discount > 0 && <span className="rounded-full bg-[#FFB020] px-3 py-1.5 text-[9px] font-black text-[#14140F] shadow-lg">-{discount}% OFF</span>}{!live && status === 'ended' && <span className="rounded-full bg-white/90 px-3 py-1.5 text-[9px] font-black text-black/60">PAST DEAL</span>}{!live && status === 'upcoming' && <span className="rounded-full bg-sky-500/90 px-3 py-1.5 text-[9px] font-black text-white">LOCKED</span>}</div><div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3 text-white"><div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/60">Real product from PrimeHub catalog</p><p className="mt-1 text-sm font-black">{product?.category || 'PrimeHub Product'}</p></div>{available && <span className="rounded-full bg-white/15 px-3 py-1.5 text-[9px] font-black backdrop-blur">Available</span>}</div></div>
          <div className="flex flex-col p-5 sm:p-7 md:p-9"><div className="flex items-center gap-2 text-[#E1352B]"><Sparkles size={15} /><p className="text-[9px] font-black uppercase tracking-[0.22em]">{live ? 'LIMITED TIME OFFER' : status === 'upcoming' ? 'NEXT WEEKLY EVENT' : 'REGULAR STOREFRONT PRICE'}</p></div><p className="mt-2 text-[10px] font-black uppercase tracking-[0.18em] text-black/35">{DAYS[day].toUpperCase()} DEAL</p><h2 className="mt-2 text-3xl font-black leading-tight tracking-tight text-[#14140F] md:text-4xl">{title}</h2>
            {live && <div className="mt-5 rounded-[24px] border border-red-500/10 bg-[#FFF7F4] p-4 shadow-inner"><p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#E1352B]">🔥 DEAL ENDS IN</p><div className="mt-2"><DealCountdown target={liveCountdownTarget} onExpired={() => setExpired(true)} /></div></div>}
            <div className="mt-6">{live && regularPrice > displayedPrice && <p className="text-sm font-bold text-black/35 line-through">Rs. {regularPrice.toLocaleString()}</p>}{status === 'upcoming' && <p className="text-[10px] font-black uppercase tracking-[0.16em] text-black/40">Regular Price</p>}<p className={`font-[family-name:var(--font-mono)] text-4xl font-black tracking-tight md:text-5xl ${live ? 'text-[#E1352B]' : 'text-[#14140F]'}`}>Rs. {displayedPrice.toLocaleString()}</p>{live && savings > 0 && <p className="mt-2 text-[10px] font-black uppercase tracking-[0.15em] text-[#0F6A5F]">SAVE Rs. {savings.toLocaleString()} — {discount}% OFF</p>}{status === 'upcoming' && configuredDealPrice > 0 && <div className="mt-4 rounded-2xl border border-sky-500/15 bg-sky-50 p-4"><p className="text-[9px] font-black uppercase tracking-[0.15em] text-sky-700">Locked Deal Price</p><p className="mt-1 text-2xl font-black text-sky-900">🔒 Rs. {configuredDealPrice.toLocaleString()}</p><p className="mt-1 text-[9px] font-black uppercase tracking-[0.15em] text-sky-700">UNLOCKS {DAYS[day].toUpperCase()}</p><div className="mt-3"><DealCountdown target={upcomingCountdownTarget} /></div></div>}{status === 'ended' && <p className="mt-2 text-[10px] font-bold text-black/40">This discounted event price is no longer active.</p>}</div>
            {live && !available && <div className="mt-4 rounded-2xl bg-[#E1352B]/8 p-3 text-xs font-bold text-[#E1352B]">This product is currently unavailable. The live price will not be applied.</div>}
            <div className="mt-6 grid gap-2 sm:grid-cols-2"><button type="button" onClick={live ? buyNow : addCurrentProduct} disabled={!available} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#14140F] px-5 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-40"><ShoppingBag size={18} /> {live ? `BUY NOW — Rs. ${displayedPrice.toLocaleString()}` : `ADD TO CART — Rs. ${regularPrice.toLocaleString()}`}</button><Link href={`/product/${product?.id}`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-black/10 px-5 text-xs font-black text-[#14140F] hover:bg-black/[0.02]">View Full Details <ChevronRight size={15} /></Link></div>
            <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-3"><div className="rounded-2xl bg-[#F4F4F1] p-3"><LockKeyhole size={16} className="text-[#0F6A5F]" /><p className="mt-2 text-[9px] font-black">Secure Checkout</p></div><div className="rounded-2xl bg-[#F4F4F1] p-3"><Store size={16} className="text-[#0F6A5F]" /><p className="mt-2 text-[9px] font-black">Retail & Wholesale</p></div>{settings.freeDelivery?.enabled ? <div className="rounded-2xl bg-[#F4F4F1] p-3"><Truck size={16} className="text-[#0F6A5F]" /><p className="mt-2 text-[9px] font-black">Free Delivery Offer</p></div> : <div className="rounded-2xl bg-[#F4F4F1] p-3"><Check size={16} className="text-[#0F6A5F]" /><p className="mt-2 text-[9px] font-black">Verified Product Data</p></div>}</div>
            {product?.description && <div className="mt-6 border-t border-black/7 pt-5"><p className="text-[9px] font-black uppercase tracking-[0.2em] text-black/35">Product details</p><p className="mt-2 whitespace-pre-line text-xs leading-5 text-black/55">{product.description}</p></div>}
          </div>
        </div>
      </section>}

      <section className={`mt-6 rounded-[32px] p-5 sm:p-7 ${live ? 'border border-white/10 bg-[#171A18] text-white shadow-[0_25px_80px_rgba(16,185,129,.08)]' : 'bg-[#14140F] text-white'}`}><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[9px] font-black uppercase tracking-[0.25em] text-[#FFB020]">Weekly event</p><h2 className="mt-1 text-2xl font-black">🔥 EXPLORE WEEKLY DEALS</h2></div><p className="text-[10px] text-white/45">All statuses use Pakistan time.</p></div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">{DAY_ORDER.map((itemDay) => { const itemStatus = statusForDay(itemDay, today); const dealItem = (settings.weeklyDeals || []).find((item) => item.day === itemDay && item.productId); const itemProduct = weeklyProducts[itemDay]; const itemImage = itemProduct?.imageUrl || ''; const active = itemDay === day; const itemDealPrice = Number(dealItem?.dealPrice || 0); const itemRegularPrice = itemProduct ? Number(itemProduct.price || 0) : 0; const showLivePrice = itemStatus === 'live' && itemDealPrice > 0; const showLockedPrice = itemStatus === 'upcoming' && itemDealPrice > 0; const imageBroken = Boolean(imageErrors[itemDay]); const itemStock = Number(itemProduct?.stock ?? 0); const itemAvailable = Boolean(itemProduct && itemStock > 0 && itemRegularPrice > 0); const added = weeklyAddedId === itemProduct?.id; return <div key={itemDay} className={`group relative overflow-hidden rounded-[22px] border transition duration-300 hover:-translate-y-1 hover:shadow-xl ${active ? 'border-white bg-white text-[#14140F] shadow-lg' : 'border-white/10 bg-white/[0.06] text-white hover:border-white/20'}`}><Link href={`/deals/${itemDay}`} className="block"><div className="relative aspect-[4/3] overflow-hidden bg-white/10">{itemImage && !imageBroken ? <img src={itemImage} alt={`${DAYS[itemDay]} deal product`} onError={() => setImageErrors((current) => ({ ...current, [itemDay]: true }))} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-white/10 to-white/5 px-3 text-center"><Tag size={18} className="opacity-30" /><span className="text-[8px] font-black uppercase tracking-wider opacity-45">No Deal Scheduled</span></div>}<div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/5" /><span className={`absolute left-2 top-2 rounded-full border px-2 py-1 text-[7px] font-black uppercase tracking-wider backdrop-blur ${statusClass(itemStatus)}`}>{dealItem ? statusLabel(itemStatus) : 'NO DEAL'}</span></div><div className="p-3"><div className="flex items-center justify-between gap-1"><span className="text-[10px] font-black">{DAYS[itemDay]}</span><ChevronRight size={12} className="shrink-0 opacity-40" /></div>{showLivePrice && <p className="mt-2 font-[family-name:var(--font-mono)] text-sm font-black text-[#E1352B]">Rs. {itemDealPrice.toLocaleString()}</p>}{showLockedPrice && <><p className="mt-2 text-[8px] font-bold opacity-45">Regular Rs. {itemRegularPrice.toLocaleString()}</p><p className={`mt-0.5 font-[family-name:var(--font-mono)] text-xs font-black ${active ? 'text-sky-700' : 'text-sky-300'}`}>🔒 Rs. {itemDealPrice.toLocaleString()}</p></>}{itemStatus === 'ended' && itemRegularPrice > 0 && <p className="mt-2 font-[family-name:var(--font-mono)] text-xs font-black opacity-55">Rs. {itemRegularPrice.toLocaleString()}</p>}{itemStatus === 'upcoming' && <p className="mt-1 text-[7px] font-black uppercase tracking-wider text-sky-300">Unlocks {DAYS[itemDay]}</p>}{itemStatus === 'live' && <p className="mt-1 text-[7px] font-black uppercase tracking-wider text-emerald-400">Live today</p>}{itemStatus === 'ended' && <p className="mt-1 text-[7px] font-black uppercase tracking-wider opacity-40">Event ended</p>}</div></Link>{dealItem && itemProduct && <div className="px-3 pb-3"><button type="button" disabled={!itemAvailable} onClick={() => addWeeklyProduct(itemDay)} className={`flex w-full items-center justify-center gap-1.5 rounded-xl px-2.5 py-2.5 text-[9px] font-black transition ${added ? 'bg-emerald-500 text-white' : itemAvailable ? 'bg-white text-[#14140F] hover:bg-[#FFB020]' : 'cursor-not-allowed bg-white/10 text-white/30'}`}>{added ? '✓ ADDED TO CART' : itemAvailable ? `🛒 ADD TO CART · Rs. ${(itemStatus === 'live' && itemDealPrice > 0 ? itemDealPrice : itemRegularPrice).toLocaleString()}` : 'UNAVAILABLE'}</button></div>}</div>; })}</div>
        {weeklyProductsLoading && <p className="mt-3 text-[8px] font-bold text-white/30">Loading assigned deal products…</p>}
      </section>
    </div>
  </main>;
}
