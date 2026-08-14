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
  if (status === 'live') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return 'border-sky-200 bg-sky-50 text-sky-700';
}

function imageOf(product: DealProduct | null, deal?: WeeklyDeal) {
  return product?.imageUrl || deal?.imageUrl || '';
}

function regularPriceOf(product: DealProduct | null, deal?: WeeklyDeal) {
  const productPrice = Number(product?.price || 0);
  return productPrice > 0 ? productPrice : Number(deal?.originalPrice || 0);
}

export default function DayDealPage() {
  const params = useParams<{ day: string }>();
  const { settings, loading } = useSettings();
  const addItem = useCartStore((state) => state.addItem);
  const today = pakistanWeekday();
  const day = String(params?.day || '').toLowerCase() as Weekday;
  const valid = Boolean(DAYS.find((item) => item.key === day));
  const status = valid ? statusForDay(day, today) : 'next-week';
  const deal = useMemo(
    () => (settings.weeklyDeals || []).find((item) => item.day === day && item.productId),
    [settings.weeklyDeals, day],
  );

  const [product, setProduct] = useState<DealProduct | null>(null);
  const [products, setProducts] = useState<Record<string, DealProduct | null>>({});
  const [addingId, setAddingId] = useState<string | null>(null);
  const [productFailed, setProductFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadProduct() {
      if (!deal?.productId) {
        setProduct(null);
        return;
      }

      try {
        const snap = await getDoc(doc(db, 'products', deal.productId));
        if (cancelled) return;
        if (!snap.exists()) {
          setProduct(null);
          setProductFailed(true);
          return;
        }
        setProduct({ id: snap.id, ...snap.data() } as DealProduct);
        setProductFailed(false);
      } catch {
        if (!cancelled) setProductFailed(true);
      }
    }

    loadProduct();
    return () => {
      cancelled = true;
    };
  }, [deal?.productId]);

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

  const label = DAYS.find((item) => item.key === day)?.label || 'Deal';
  const regularPrice = regularPriceOf(product, deal);
  const dealPrice = Number(deal?.dealPrice || 0);
  const discount =
    regularPrice > dealPrice && dealPrice > 0
      ? Math.round(((regularPrice - dealPrice) / regularPrice) * 100)
      : 0;
  const live =
    status === 'live' &&
    Boolean(deal?.active !== false && deal?.productId && product && !productFailed && dealPrice > 0);
  const title = product?.title || deal?.title || `${label} Deal`;
  const image = imageOf(product, deal);
  const available = Number(product?.stock ?? 0) > 0;

  const addToCart = (itemDeal: WeeklyDeal, itemStatus: DealStatus) => {
    const itemProduct = products[itemDeal.productId];
    if (!itemProduct || Number(itemProduct.stock ?? 0) <= 0) return;

    const regular = regularPriceOf(itemProduct, itemDeal);
    const configuredDealPrice = Number(itemDeal.dealPrice || 0);
    const price =
      itemStatus === 'live' && itemDeal.active !== false && configuredDealPrice > 0
        ? configuredDealPrice
        : regular;
    if (price <= 0) return;

    const itemImage = imageOf(itemProduct, itemDeal);
    addItem({
      id: itemProduct.id,
      name: itemProduct.title || itemDeal.title || `${itemDeal.day} Deal`,
      price,
      originalPrice:
        regular > price ? regular : Number(itemProduct.originalPrice || regular),
      image: itemImage || undefined,
      imageUrl: itemImage || undefined,
      ...(itemStatus === 'live' ? { dealDay: itemDeal.day } : {}),
    });

    setAddingId(itemDeal.id);
    window.setTimeout(
      () => setAddingId((current) => (current === itemDeal.id ? null : current)),
      1200,
    );
  };

  if (!valid) {
    return (
      <main className="min-h-screen bg-neutral-50 px-4 py-10 pb-28">
        <div className="mx-auto max-w-2xl rounded-[30px] bg-white p-10 text-center shadow-sm">
          <Tag className="mx-auto h-10 w-10 text-black/20" />
          <h1 className="mt-4 text-2xl font-black">Deal day not found</h1>
          <Link
            href="/deals"
            className="mt-5 inline-flex rounded-full bg-[#14140F] px-5 py-3 text-xs font-black text-white"
          >
            Back to Deals
          </Link>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-50 px-4 py-5 pb-28">
        <div className="mx-auto max-w-6xl">
          <div className="h-10 w-28 animate-pulse rounded-full bg-white" />
          <div className="mt-5 h-16 animate-pulse rounded-[24px] bg-white" />
          <div className="mt-5 grid gap-4 lg:grid-cols-[1.05fr_.95fr]">
            <div className="aspect-square animate-pulse rounded-[30px] bg-white" />
            <div className="min-h-[420px] animate-pulse rounded-[30px] bg-white" />
          </div>
        </div>
      </main>
    );
  }

  const weeklyDeals = (settings.weeklyDeals || []).filter((item) => item.productId);

  return (
    <main className="min-h-screen bg-neutral-50 pb-28">
      <div className="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-7">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/deals"
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[10px] font-black shadow-sm"
          >
            <ArrowLeft size={14} /> Back to Deals
          </Link>
          <span className="text-[9px] font-black uppercase tracking-[0.22em] text-black/35">
            Weekly Deal • {label}
          </span>
        </div>

        <header className="mt-5 rounded-[28px] bg-white p-5 shadow-sm md:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-3 py-1.5 text-[9px] font-black uppercase tracking-wide ${statusStyles(status)}`}
            >
              {statusLabel(status)}
            </span>
            {discount > 0 && (
              <span className="rounded-full bg-[#E1352B] px-3 py-1.5 text-[9px] font-black text-white">
                -{discount}% OFF
              </span>
            )}
          </div>
          <p className="mt-4 text-[9px] font-black uppercase tracking-[0.25em] text-[#E1352B]">
            {label} Deal
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-tight md:text-5xl">
            {title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-black/50">
            {status === 'live'
              ? `Today's special price is live in Pakistan time. It rolls back to the regular price when the day ends and returns next ${label}.`
              : status === 'upcoming'
                ? `This deal is scheduled for ${label}. The special price unlocks automatically when ${label} arrives.`
                : `This ${label} deal is coming next week. Its special price returns automatically on the next ${label}.`}
          </p>
        </header>

        <section className="mt-5 overflow-hidden rounded-[30px] border border-black/5 bg-white shadow-sm">
          <div className="grid lg:grid-cols-[1.05fr_.95fr]">
            <div className="relative aspect-square bg-[#F4F4F1] lg:aspect-auto lg:min-h-[560px]">
              {image ? (
                <img src={image} alt={title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full min-h-[360px] items-center justify-center text-xs font-bold text-black/25">
                  No product image
                </div>
              )}
              <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                <span
                  className={`rounded-full border px-3 py-1.5 text-[9px] font-black ${statusStyles(status)}`}
                >
                  {statusLabel(status)}
                </span>
                {discount > 0 && (
                  <span className="rounded-full bg-[#E1352B] px-3 py-1.5 text-[9px] font-black text-white">
                    -{discount}% OFF
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col justify-center p-6 md:p-10">
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#E1352B]">
                {label} Deal
              </p>
              <h2 className="mt-2 text-3xl font-black md:text-4xl">{title}</h2>

              <div className="mt-6 flex items-end gap-3">
                <span className="font-[family-name:var(--font-mono)] text-3xl font-black text-[#E1352B]">
                  Rs. {dealPrice > 0 ? dealPrice.toLocaleString() : '—'}
                </span>
                {regularPrice > dealPrice && (
                  <span className="pb-1 text-sm text-black/35 line-through">
                    Rs. {regularPrice.toLocaleString()}
                  </span>
                )}
              </div>

              <p className="mt-2 text-xs leading-5 text-black/45">
                {status === 'live'
                  ? 'Special deal price is active today.'
                  : status === 'upcoming'
                    ? `Special deal price unlocks on ${label}.`
                    : `Special deal price returns next ${label}.`}
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!product || !available || regularPrice <= 0 || addingId === deal?.id}
                  onClick={() => deal && addToCart(deal, status)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#14140F] px-5 py-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <ShoppingBag size={15} />
                  {addingId === deal?.id
                    ? 'ADDED'
                    : status === 'live'
                      ? 'ADD TO CART'
                      : 'SHOP NOW'}
                </button>
                {product && (
                  <Link
                    href={`/product/${product.id}`}
                    className="inline-flex items-center gap-2 rounded-xl border border-black/10 px-5 py-3 text-xs font-black"
                  >
                    View Product <ChevronRight size={15} />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-[30px] bg-neutral-50 p-1">
          <div className="rounded-[28px] bg-white p-5 shadow-sm md:p-7">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[#E1352B]">
                  Keep exploring
                </p>
                <h2 className="mt-1 text-2xl font-black">EXPLORE WEEKLY DEALS</h2>
              </div>
              <Link
                href="/deals"
                className="text-[9px] font-black uppercase tracking-[0.18em] text-black/40"
              >
                View all
              </Link>
            </div>

            {!weeklyDeals.length ? (
              <div className="mt-5 rounded-2xl border border-dashed border-black/10 bg-neutral-50 p-6 text-center">
                <p className="text-xs font-bold text-black/40">No weekly deals scheduled yet.</p>
              </div>
            ) : (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {DAYS.map(({ key, label: itemLabel }) => {
                  const itemDeal = weeklyDeals.find((item) => item.day === key);
                  if (!itemDeal) return null;

                  const itemProduct = products[itemDeal.productId] || null;
                  const itemStatus = statusForDay(key, today);
                  const itemRegular = regularPriceOf(itemProduct, itemDeal);
                  const itemDealPrice = Number(itemDeal.dealPrice || 0);
                  const itemDiscount =
                    itemRegular > itemDealPrice && itemDealPrice > 0
                      ? Math.round(((itemRegular - itemDealPrice) / itemRegular) * 100)
                      : 0;
                  const itemImage = imageOf(itemProduct, itemDeal);
                  const itemTitle = itemProduct?.title || itemDeal.title || `${itemLabel} Deal`;
                  const itemAvailable = Number(itemProduct?.stock ?? 0) > 0;

                  return (
                    <article
                      key={itemDeal.id}
                      className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm"
                    >
                      <Link href={`/deals/${key}`} className="block">
                        <div className="relative aspect-square bg-[#F4F4F1]">
                          {itemImage ? (
                            <img
                              src={itemImage}
                              alt={itemTitle}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs font-bold text-black/25">
                              No product image
                            </div>
                          )}
                          <div className="absolute left-2.5 right-2.5 top-2.5 flex items-start justify-between gap-2">
                            <span
                              className={`rounded-full border px-2 py-1 text-[7px] font-black ${statusStyles(itemStatus)}`}
                            >
                              {statusLabel(itemStatus)}
                            </span>
                            {itemDiscount > 0 && (
                              <span className="rounded-full bg-[#E1352B] px-2 py-1 text-[8px] font-black text-white">
                                -{itemDiscount}%
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>

                      <div className="p-3.5">
                        <p className="text-[8px] font-black uppercase tracking-[0.18em] text-[#E1352B]">
                          {itemLabel} Deal
                        </p>
                        <h3 className="mt-1 line-clamp-2 min-h-[38px] text-sm font-black">
                          {itemTitle}
                        </h3>

                        <div className="mt-2 flex items-end gap-2">
                          <span className="font-[family-name:var(--font-mono)] text-lg font-black text-[#E1352B]">
                            Rs. {itemDealPrice > 0 ? itemDealPrice.toLocaleString() : '—'}
                          </span>
                          {itemRegular > itemDealPrice && (
                            <span className="pb-0.5 text-[10px] text-black/35 line-through">
                              Rs. {itemRegular.toLocaleString()}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={!itemProduct || !itemAvailable || itemRegular <= 0 || addingId === itemDeal.id}
                          onClick={() => addToCart(itemDeal, itemStatus)}
                          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#14140F] px-3 py-2.5 text-[9px] font-black text-white disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          <ShoppingBag size={13} />
                          {addingId === itemDeal.id
                            ? 'ADDED'
                            : itemStatus === 'live'
                              ? 'ADD TO CART'
                              : 'SHOP NOW'}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
