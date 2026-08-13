'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Clock3,
  LockKeyhole,
  ShoppingBag,
  Sparkles,
  Store,
  Tag,
  Truck,
  Zap,
} from 'lucide-react';
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

function pakistanWeekday(): Weekday {
  const value = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Karachi', weekday: 'long' }).format(new Date()).toLowerCase();
  return (DAY_ORDER.includes(value as Weekday) ? value : 'sunday') as Weekday;
}

function nextPakistanMidnightISO() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Karachi', year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);
  return new Date(Date.UTC(year, month - 1, day + 1) - 5 * 60 * 60 * 1000).toISOString();
}

function statusForDay(day: Weekday, today: Weekday): DealStatus {
  const selectedIndex = DAY_ORDER.indexOf(day);
  const todayIndex = DAY_ORDER.indexOf(today);
  if (selectedIndex === todayIndex) return 'live';
  return selectedIndex > todayIndex ? 'upcoming' : 'ended';
}

function statusLabel(status: DealStatus) {
  if (status === 'live') return 'LIVE';
  if (status === 'upcoming') return 'COMING SOON';
  return 'ENDED';
}

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

  const deal = useMemo(
    () => (settings.weeklyDeals || []).find((item) => item.day === day && item.productId),
    [settings.weeklyDeals, day]
  );

  const [product, setProduct] = useState<Product | null>(null);
  const [productLoading, setProductLoading] = useState(false);
  const [productFailed, setProductFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadProduct() {
      if (!deal?.productId) {
        setProduct(null);
        return;
      }
      setProductLoading(true);
      setProductFailed(false);
      try {
        const snap = await getDoc(doc(db, 'products', deal.productId));
        if (cancelled) return;
        if (!snap.exists()) {
          setProduct(null);
          setProductFailed(true);
        } else {
          setProduct({ id: snap.id, ...snap.data() } as Product);
        }
      } catch {
        if (!cancelled) setProductFailed(true);
      } finally {
        if (!cancelled) setProductLoading(false);
      }
    }
    loadProduct();
    return () => { cancelled = true; };
  }, [deal?.productId]);

  if (!valid) {
    return (
      <main className="min-h-screen bg-[#F4F4F1] px-4 py-10">
        <div className="mx-auto max-w-2xl rounded-[32px] bg-white p-10 text-center shadow-sm">
          <Tag className="mx-auto h-10 w-10 text-black/20" />
          <h1 className="mt-4 text-2xl font-black">Deal day not found</h1>
          <Link href="/" className="mt-5 inline-flex rounded-full bg-[#14140F] px-5 py-3 text-xs font-black text-white">Back Home</Link>
        </div>
      </main>
    );
  }

  if (loading || productLoading) {
    return (
      <main className="min-h-screen bg-[#F4F4F1] px-4 pb-28 pt-5">
        <div className="mx-auto max-w-6xl">
          <div className="h-10 w-28 animate-pulse rounded-full bg-white" />
          <div className="mt-4 h-36 animate-pulse rounded-[32px] bg-[#14140F]/10" />
          <div className="mt-4 grid gap-4 lg:grid-cols-[1.05fr_.95fr]">
            <div className="aspect-square animate-pulse rounded-[32px] bg-black/5 lg:aspect-auto lg:min-h-[560px]" />
            <div className="min-h-[560px] animate-pulse rounded-[32px] bg-white" />
          </div>
        </div>
      </main>
    );
  }

  const scheduled = Boolean(deal?.productId && product && !productFailed);
  const live = status === 'live' && scheduled && deal?.active !== false && Number(deal?.dealPrice) > 0;
  const stock = Number(product?.stock ?? 0);
  const available = stock > 0;
  const regularPrice = product ? (Number(product.originalPrice) > Number(product.price) ? Number(product.originalPrice) : Number(product.price)) : 0;
  const configuredDealPrice = Number(deal?.dealPrice || 0);
  const displayedPrice = live ? configuredDealPrice : regularPrice;
  const savings = live && regularPrice > configuredDealPrice ? regularPrice - configuredDealPrice : 0;
  const discount = savings > 0 ? Math.round((savings / regularPrice) * 100) : 0;
  const title = product?.title || deal?.title || `${DAYS[day]} Deal`;
  const image = product?.imageUrl || deal?.imageUrl || '';

  const buyNow = () => {
    if (!product || !live || !available || configuredDealPrice <= 0) return;
    addItem({
      id: product.id,
      name: title,
      price: configuredDealPrice,
      originalPrice: regularPrice,
      image: image || undefined,
      imageUrl: image || undefined,
      dealDay: day,
    });
    router.push('/checkout');
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#F4F4F1] pb-28">
      {live && <DealCelebration />}
      <div className="mx-auto max-w-6xl px-4 py-4 md:px-6 md:py-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[10px] font-black shadow-sm"><ArrowLeft size={14} /> Back to Home</Link>
          <span className="hidden text-[9px] font-black uppercase tracking-[0.25em] text-black/35 sm:block">PrimeHub Live Deal Experience</span>
        </div>

        <section className={`relative mt-4 overflow-hidden rounded-[32px] p-6 text-white shadow-sm md:p-9 ${live ? 'bg-[#14140F]' : status === 'upcoming' ? 'bg-[#10202A]' : 'bg-[#20201C]'}`}>
          <div className="absolute -right-20 -top-24 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="relative">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-wider ${live ? 'bg-[#E1352B] text-white' : 'bg-white/10 text-white/70'}`}>{live ? 'LIVE NOW' : status === 'upcoming' ? 'COMING SOON' : 'DEAL ENDED'}</span>
              {live && <span className="rounded-full bg-[#FFB020] px-3 py-1.5 text-[9px] font-black text-[#14140F]">TODAY ONLY</span>}
            </div>
            <p className="mt-5 text-[9px] font-black uppercase tracking-[0.3em] text-[#FFB020]">One day special offer</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight md:text-6xl">{DAYS[day]} Deal</h1>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-white/55 md:text-sm">{live ? 'A premium one-day event price is live right now. Secure the deal before Pakistan time reaches midnight.' : status === 'upcoming' ? `The ${DAYS[day]} event is scheduled next. Its special price is not active yet.` : `The ${DAYS[day]} event has ended. The product is shown at its regular storefront price.`}</p>
          </div>
        </section>

        {!scheduled ? (
          <section className="mt-4 rounded-[32px] border border-black/6 bg-white p-8 text-center shadow-sm md:p-12">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-black/5"><Tag size={25} className="text-black/30" /></div>
            <p className="mt-5 text-[9px] font-black uppercase tracking-[0.25em] text-[#E1352B]">No scheduled product</p>
            <h2 className="mt-2 text-2xl font-black">No Deal Scheduled For This Day</h2>
            <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-black/45">The selected day has no product assigned in the Admin Panel, so no invented deal content is shown.</p>
            <Link href={`/deals/${today}`} className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#14140F] px-5 py-3 text-xs font-black text-white">View Today's Deal <ChevronRight size={15} /></Link>
          </section>
        ) : (
          <section className="mt-4 overflow-hidden rounded-[32px] border border-black/6 bg-white shadow-sm">
            <div className="grid lg:grid-cols-[1.05fr_.95fr]">
              <div className="relative min-h-[360px] bg-[#EEEDE7] lg:min-h-[610px]">
                {image ? <img src={image} alt={title} className="absolute inset-0 h-full w-full object-cover" /> : <div className="flex h-full min-h-[360px] items-center justify-center text-xs font-bold text-black/25">No product image</div>}
                <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/40 to-transparent" />
                <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                  {live && <span className="flex items-center gap-1.5 rounded-full bg-[#E1352B] px-3 py-1.5 text-[9px] font-black text-white shadow-lg"><Zap size={11} fill="currentColor" /> LIVE DEAL</span>}
                  {live && discount > 0 && <span className="rounded-full bg-[#FFB020] px-3 py-1.5 text-[9px] font-black text-[#14140F] shadow-lg">-{discount}% OFF</span>}
                  {!live && status === 'ended' && <span className="rounded-full bg-white/90 px-3 py-1.5 text-[9px] font-black text-black/60">PAST DEAL</span>}
                  {!live && status === 'upcoming' && <span className="rounded-full bg-sky-500/90 px-3 py-1.5 text-[9px] font-black text-white">UPCOMING</span>}
                </div>
                <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3 text-white">
                  <div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/60">Real product from PrimeHub catalog</p><p className="mt-1 text-sm font-black">{product?.category || 'PrimeHub Product'}</p></div>
                  {available && <span className="rounded-full bg-white/15 px-3 py-1.5 text-[9px] font-black backdrop-blur">Available</span>}
                </div>
              </div>

              <div className="flex flex-col p-5 sm:p-7 md:p-9">
                <div className="flex items-center gap-2 text-[#E1352B]"><Sparkles size={15} /><p className="text-[9px] font-black uppercase tracking-[0.22em]">{live ? 'LIMITED TIME OFFER' : status === 'upcoming' ? 'NEXT WEEKLY EVENT' : 'REGULAR STOREFRONT PRICE'}</p></div>
                <p className="mt-2 text-[10px] font-black uppercase tracking-[0.18em] text-black/35">{DAYS[day].toUpperCase()} DEAL</p>
                <h2 className="mt-2 text-3xl font-black leading-tight tracking-tight text-[#14140F] md:text-4xl">{title}</h2>

                <div className="mt-6">
                  {live && regularPrice > displayedPrice && <p className="text-sm font-bold text-black/35 line-through">Rs. {regularPrice.toLocaleString()}</p>}
                  <p className={`font-[family-name:var(--font-mono)] text-4xl font-black tracking-tight md:text-5xl ${live ? 'text-[#E1352B]' : 'text-[#14140F]'}`}>Rs. {displayedPrice.toLocaleString()}</p>
                  {live && savings > 0 && <p className="mt-2 text-[10px] font-black uppercase tracking-[0.15em] text-[#0F6A5F]">SAVE Rs. {savings.toLocaleString()} — {discount}% OFF</p>}
                  {!live && <p className="mt-2 text-[10px] font-bold text-black/40">The discounted price is not purchasable outside the live {DAYS[day]} window.</p>}
                </div>

                {live && <div className="mt-5"><DealCountdown target={nextPakistanMidnightISO()} /></div>}
                {live && !available && <div className="mt-4 rounded-2xl bg-[#E1352B]/8 p-3 text-xs font-bold text-[#E1352B]">This product is currently unavailable. The live price will not be applied.</div>}

                <div className="mt-6 grid gap-2 sm:grid-cols-2">
                  {live ? (
                    <button type="button" onClick={buyNow} disabled={!available} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#14140F] px-5 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"><ShoppingBag size={18} /> BUY NOW — Rs. {displayedPrice.toLocaleString()}</button>
                  ) : (
                    <Link href={`/deals/${today}`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#14140F] px-5 text-sm font-black text-white"><Zap size={17} fill="currentColor" /> VIEW TODAY'S LIVE DEAL</Link>
                  )}
                  <Link href={`/product/${product?.id}`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-black/10 px-5 text-xs font-black text-[#14140F] hover:bg-black/[0.02]">View Full Details <ChevronRight size={15} /></Link>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div className="rounded-2xl bg-[#F4F4F1] p-3"><LockKeyhole size={16} className="text-[#0F6A5F]" /><p className="mt-2 text-[9px] font-black">Secure Checkout</p></div>
                  <div className="rounded-2xl bg-[#F4F4F1] p-3"><Store size={16} className="text-[#0F6A5F]" /><p className="mt-2 text-[9px] font-black">Retail & Wholesale</p></div>
                  {settings.freeDelivery?.enabled ? <div className="rounded-2xl bg-[#F4F4F1] p-3"><Truck size={16} className="text-[#0F6A5F]" /><p className="mt-2 text-[9px] font-black">Free Delivery Offer</p></div> : <div className="rounded-2xl bg-[#F4F4F1] p-3"><Check size={16} className="text-[#0F6A5F]" /><p className="mt-2 text-[9px] font-black">Verified Product Data</p></div>}
                </div>

                {product?.description && <div className="mt-6 border-t border-black/7 pt-5"><p className="text-[9px] font-black uppercase tracking-[0.2em] text-black/35">Product details</p><p className="mt-2 whitespace-pre-line text-xs leading-5 text-black/55">{product.description}</p></div>}
              </div>
            </div>
          </section>
        )}

        <section className="mt-6 rounded-[32px] bg-[#14140F] p-5 text-white sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[9px] font-black uppercase tracking-[0.25em] text-[#FFB020]">Weekly event</p><h2 className="mt-1 text-2xl font-black">🔥 EXPLORE WEEKLY DEALS</h2></div><p className="text-[10px] text-white/45">All statuses use Pakistan time.</p></div>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {DAY_ORDER.map((itemDay) => {
              const itemStatus = statusForDay(itemDay, today);
              const hasDeal = Boolean((settings.weeklyDeals || []).some((item) => item.day === itemDay && item.productId));
              const active = itemDay === day;
              return <Link key={itemDay} href={`/deals/${itemDay}`} className={`rounded-2xl border p-3 transition hover:-translate-y-0.5 ${active ? 'border-white bg-white text-[#14140F]' : 'border-white/10 bg-white/5 text-white'}`}><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-black">{DAYS[itemDay]}</span><ChevronRight size={13} className="shrink-0 opacity-50" /></div><span className={`mt-2 inline-flex rounded-full border px-2 py-1 text-[8px] font-black ${statusClass(itemStatus)}`}>{hasDeal ? statusLabel(itemStatus) : 'NO DEAL'}</span></Link>;
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
