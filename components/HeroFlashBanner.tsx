"use client";

import Image from "next/image";
import HomeHeading from "@/components/home/HomeHeading";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Gift,
  Sparkles,
  Star,
  Tags,
  Trophy,
  WandSparkles,
  ShoppingCart,
  LockKeyhole,
} from "lucide-react";
import { collection, onSnapshot } from "firebase/firestore";
import { useSettings } from "@/lib/useSettings";
import { useCartStore } from "@/lib/cartStore";
import { db } from "@/lib/firebase";
import { getEffectivePrice } from "@/lib/dealPricing";
import { normalizeImageUrl } from "@/lib/imageUrl";
import type { Product, Weekday } from "@/lib/types";
import {
  WEEKDAY_LABELS,
  WEEKDAY_ORDER,
  dealTiming,
  pakistanNowWeekday,
  countdownParts,
  weeklyDealSavings,
} from "@/lib/weeklyDealUtils";
import {
  bigDealConfiguredSlotCount,
  nextBigDealRotationIndex,
} from "@/lib/bigDealRotation";

const DAYS: Array<{ key: Weekday; label: string; Icon: typeof Gift }> = [
  { key: "sunday", label: "Sunday Deal", Icon: Gift },
  { key: "monday", label: "Monday Deal", Icon: Gift },
  { key: "tuesday", label: "Tuesday Deal", Icon: Sparkles },
  { key: "wednesday", label: "Wednesday Deal", Icon: Star },
  { key: "thursday", label: "Thursday Deal", Icon: Tags },
  { key: "friday", label: "Friday Deal", Icon: Trophy },
  { key: "saturday", label: "Saturday Deal", Icon: WandSparkles },
];

function pakistanMidnightCountdown(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1, -5, 0, 0));
  return countdownParts(tomorrow.getTime() - now.getTime());
}

function hasProductVariants(product?: Product): boolean {
  if (!product) return false;
  return Boolean(
    (Array.isArray(product.variants) && product.variants.length > 0) ||
    (Array.isArray(product.variantMatrix) && product.variantMatrix.length > 0) ||
    (Array.isArray(product.variantOptions) && product.variantOptions.length > 0) ||
    (Array.isArray(product.variantColors) && product.variantColors.length > 0) ||
    (Array.isArray(product.variantSizes) && product.variantSizes.length > 0) ||
    (Array.isArray(product.colors) && product.colors.length > 0) ||
    (Array.isArray(product.sizes) && product.sizes.length > 0) ||
    product.hasVariants === true,
  );
}

type ProductDealFields = Product & {
  stock?: number | string;
  quantity?: number | string;
  dealPrice?: number | string;
  originalPrice?: number | string;
  normalPrice?: number | string;
};

type BigDealFields = NonNullable<ReturnType<typeof useSettings>["settings"]["dailyDeal"]> & {
  dealPrice?: number | string;
  normalPrice?: number | string;
  originalPrice?: number | string;
  stock?: number | string;
  imageUrls?: unknown[];
  productIds?: unknown[];
  titles?: unknown[];
  originalPrices?: unknown[];
  dealPrices?: unknown[];
  rotationStartedAt?: string;
};

function productMap(list: Product[]) {
  return Object.fromEntries(list.map((product) => [product.id, product]));
}

function cleanBigDealTitle(value: unknown) {
  const title = String(value || "Big Deal").trim() || "Big Deal";
  return title.replace(/\b(?:rs\.?\s*)?\d{3,6}\b/gi, " ").replace(/\s{2,}/g, " ").replace(/\s+([,.:;-])/g, "$1").trim() || "Big Deal";
}

function bigDealSlotAt(deal: BigDealFields | undefined, index: number) {
  if (!deal) return null;
  const images = Array.isArray(deal.imageUrls) ? deal.imageUrls : [];
  const productIds = Array.isArray(deal.productIds) ? deal.productIds : [];
  const titles = Array.isArray(deal.titles) ? deal.titles : [];
  const originalPrices = Array.isArray(deal.originalPrices) ? deal.originalPrices : [];
  const dealPrices = Array.isArray(deal.dealPrices) ? deal.dealPrices : [];
  const dealPrice = Number(dealPrices[index] ?? deal.dealPrice ?? 0);
  const originalPrice = Number(originalPrices[index] ?? deal.originalPrice ?? 0);
  return {
    imageUrl: normalizeImageUrl(String(images[index] || deal.imageUrl || images[0] || "")),
    productId: String(productIds[index] || deal.productId || productIds[0] || "").trim(),
    title: cleanBigDealTitle(titles[index] || deal.title || titles[0]),
    originalPrice: Math.max(0, Number.isFinite(originalPrice) ? originalPrice : 0),
    dealPrice: Math.max(0, Number.isFinite(dealPrice) ? dealPrice : 0),
  };
}

export default function HeroFlashBanner({ initialProducts = [], liveUpdates = true, homeLayout = false }: { initialProducts?: Product[]; liveUpdates?: boolean; homeLayout?: boolean }) {
  const { settings } = useSettings();
  const [nowTick, setNowTick] = useState<number | null>(() => Date.now());
  const [products, setProducts] = useState<Record<string, Product>>(() => productMap(initialProducts));
  const weeklyDeals = settings.weeklyDeals || [];
  const bigDeal = settings.dailyDeal as BigDealFields | undefined;
  const addItem = useCartStore((state) => state.addItem);
  const openVariantModal = useCartStore((state) => state.openVariantModal);

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!liveUpdates) setProducts(productMap(initialProducts));
  }, [initialProducts, liveUpdates]);

  useEffect(() => {
    if (!liveUpdates) return;
    return onSnapshot(collection(db, "products"), (snapshot) => {
      const next: Record<string, Product> = {};
      snapshot.forEach((doc) => {
        next[doc.id] = { id: doc.id, ...doc.data() } as Product;
      });
      setProducts(next);
    }, () => undefined);
  }, [liveUpdates]);

  const todayKey = nowTick === null ? null : pakistanNowWeekday(new Date(nowTick));
  const countdown = useMemo(() => {
    if (nowTick === null) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    const end = bigDeal?.endAt ? new Date(bigDeal.endAt).getTime() : 0;
    const fallback = pakistanMidnightCountdown(new Date(nowTick));
    return countdownParts(end > nowTick ? end - nowTick : fallback.days * 86400000 + fallback.hours * 3600000 + fallback.minutes * 60000 + fallback.seconds * 1000);
  }, [bigDeal?.endAt, nowTick]);
  void countdown;

  const orderedDays = useMemo(() => {
    if (!todayKey) return DAYS;
    const todayIndex = WEEKDAY_ORDER.indexOf(todayKey);
    return [...DAYS.slice(todayIndex), ...DAYS.slice(0, todayIndex)];
  }, [todayKey]);

  function addDealToCart(deal: NonNullable<typeof weeklyDeals>[number]) {
    const product = products[deal.productId];
    const normalPrice = Number(deal.normalPrice || deal.originalPrice || product?.normalPrice || product?.price || 0);
    const specialPrice = Number(deal.dealPrice || 0);
    const dealDay = deal.day ? `${deal.day.charAt(0).toUpperCase()}${deal.day.slice(1)}` : undefined;
    const price = getEffectivePrice({ price: normalPrice, dealPrice: specialPrice, dealDay }, new Date(nowTick || Date.now()));
    const isLive = todayKey === deal.day && specialPrice > 0 && price === specialPrice;
    if (!deal.productId || price <= 0 || Number((product as ProductDealFields | undefined)?.stock ?? 1) <= 0) return;
    const image = normalizeImageUrl(product?.imageUrl || deal.imageUrl || "");
    const productWithDealPrice = {
      ...product,
      id: deal.productId,
      title: product?.title || deal.title,
      price,
      originalPrice: isLive ? Number(product?.originalPrice || deal.originalPrice || price) : normalPrice,
      image,
      imageUrl: image,
    } as Product;
    if (hasProductVariants(productWithDealPrice) && openVariantModal(productWithDealPrice, "cart")) return;
    addItem({
      id: deal.productId,
      name: productWithDealPrice.title || deal.title,
      price,
      originalPrice: productWithDealPrice.originalPrice || price,
      image,
      imageUrl: image,
      dealDay: isLive ? deal.day : undefined,
    });
  }

  function addBigDealToCart() {
    if (!bigDeal?.productId) return;
    const product = products[bigDeal.productId];
    const productData = product as ProductDealFields | undefined;
    const currentPrice = Number(bigDeal.dealPrice || productData?.dealPrice || productData?.price || 0);
    const normalPrice = Number(bigDeal.normalPrice || productData?.originalPrice || productData?.normalPrice || currentPrice);
    const stock = Number(productData?.stock ?? productData?.quantity ?? bigDeal.stock ?? 0);
    if (currentPrice <= 0 || stock <= 0) return;
    const image = normalizeImageUrl(productData?.imageUrl || bigDeal.imageUrl || "");
    const productWithDealPrice = { ...product, id: bigDeal.productId, title: product?.title || bigDeal.title, price: currentPrice, originalPrice: normalPrice, image, imageUrl: image } as Product;
    if (hasProductVariants(productWithDealPrice) && openVariantModal(productWithDealPrice, "cart")) return;
    addItem({ id: bigDeal.productId, name: productWithDealPrice.title || bigDeal.title, price: currentPrice, originalPrice: productWithDealPrice.originalPrice || currentPrice, image, imageUrl: image });
  }

  if (homeLayout) {
    const product = bigDeal?.productId ? (products[bigDeal.productId] as ProductDealFields | undefined) : undefined;
    const price = Number(bigDeal?.dealPrice || product?.dealPrice || product?.price || 0);
    const regularPrice = Number(bigDeal?.normalPrice || bigDeal?.originalPrice || product?.normalPrice || product?.originalPrice || product?.price || price);
    const saved = Math.max(0, regularPrice - price);
    const stock = Number(product?.stock ?? product?.quantity ?? bigDeal?.stock ?? 0);
    const src = normalizeImageUrl(bigDeal?.imageUrl || product?.imageUrl || "");
    const slotCount = bigDealConfiguredSlotCount(bigDeal);
    const nextDeal = bigDealSlotAt(bigDeal, nextBigDealRotationIndex(bigDeal?.rotationStartedAt, new Date(nowTick || Date.now()), slotCount));
    const nextSrc = normalizeImageUrl(nextDeal?.imageUrl || "");
    const nextPrice = Number(nextDeal?.dealPrice || 0);
    const nextRegularPrice = Number(nextDeal?.originalPrice || nextPrice || 0);
    const nextSaved = Math.max(0, nextRegularPrice - nextPrice);
    const end = bigDeal?.endAt ? new Date(bigDeal.endAt).getTime() : null;
    const start = bigDeal?.startAt ? new Date(bigDeal.startAt).getTime() : null;
    const live = nowTick !== null && (!start || nowTick >= start) && (!end || nowTick < end);
    return (
      <>
        <section className="home-weekly" id="weekly-deals">
          <HomeHeading>PrimeHubMall Weekly Deals</HomeHeading>
          <div className="home-week-grid">
            {orderedDays.map(({ key, Icon }) => {
              const deal = weeklyDeals.find((d) => d.day === key && d.active !== false && Number(d.dealPrice) > 0);
              const dealProduct = deal ? (products[deal.productId] as ProductDealFields | undefined) : undefined;
              const dealPrice = Number(deal?.dealPrice || 0);
              const weeklyRegular = Number(deal?.normalPrice || deal?.originalPrice || dealProduct?.normalPrice || dealProduct?.price || dealPrice);
              const saving = Math.max(0, weeklyRegular - dealPrice);
              const dealImage = normalizeImageUrl(deal?.imageUrl || (deal ? products[deal.productId]?.imageUrl : "") || "");
              const isLive = Boolean(deal && todayKey === key);
              const weeklyTiming = deal && nowTick !== null ? dealTiming(deal.day, new Date(nowTick)) : null;
              const dealCountdown = weeklyTiming && nowTick !== null ? countdownParts(weeklyTiming.unlockAt.getTime() - nowTick) : null;
              return (
                <article key={key} className={`home-week-card ${isLive ? "is-live" : ""}`}>
                  <Link className="home-week-link" href={deal ? `/product/${deal.productId}` : "/weekly-deals"}>
                    <strong>{key.slice(0, 3).toUpperCase()}</strong>
                    {saving > 0 ? (
                      <em className="home-week-saving">Save Rs. {saving.toLocaleString("en-PK")}</em>
                    ) : null}
                    <span className={`home-week-status ${isLive ? "is-live" : ""}`}>
                      <span className={isLive ? "home-live" : "home-unlocks"}>
                        {isLive ? "● LIVE" : <><LockKeyhole size={9} />{deal ? "UNLOCKS" : "SOON"}</>}
                      </span>
                      {dealCountdown ? (
                        <small className="home-week-countdown">
                          {isLive ? "Ends in " : ""}{dealCountdown.days > 0 ? `${dealCountdown.days}d ` : ""}{String(dealCountdown.hours).padStart(2, "0")}h {String(dealCountdown.minutes).padStart(2, "0")}m {String(dealCountdown.seconds).padStart(2, "0")}s
                        </small>
                      ) : null}
                    </span>
                    <span className="home-week-image">
                      {dealImage ? <Image src={dealImage} alt={deal?.title || key} fill sizes="(max-width: 600px) 90px, 170px" className="object-cover" /> : <Icon size={25} />}
                    </span>
                    {deal ? (
                      <span className="home-week-pricing">
                        <small>Deal <b>Rs. {dealPrice.toLocaleString("en-PK")}</b></small>
                        <small>Regular <s>Rs. {weeklyRegular.toLocaleString("en-PK")}</s></small>
                      </span>
                    ) : <b className="home-price">Coming soon</b>}
                  </Link>
                  {deal ? (
                    <button type="button" className="home-week-add" onClick={() => addDealToCart(deal)} disabled={!dealProduct || Number(dealProduct.stock ?? dealProduct.quantity ?? 1) <= 0}>
                      <ShoppingCart size={11} /> Add · Rs. {dealPrice.toLocaleString("en-PK")}
                    </button>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
        {bigDeal?.active && bigDeal.title && (
          <section className="home-big-deal">
            <HomeHeading>PrimeHubMall Big Deal of the Day</HomeHeading>
            <div className="home-big-grid">
              <article className="home-big-card">
                <Link className="home-big-image" href={bigDeal.productId ? `/product/${bigDeal.productId}` : "/deals/big"}>
                  {src && <Image src={src} alt={bigDeal.title} fill priority loading="eager" fetchPriority="high" unoptimized sizes="(max-width: 600px) 50vw, 600px" className="object-cover" />}
                  <span className="home-live">{live ? "● LIVE" : "SCHEDULED"}</span>
                  {stock > 0 && stock <= 10 ? <span className="home-urgency">Only {stock} left</span> : null}
                  <span className="home-big-seal">BIG<br />DEAL<small>OF THE DAY</small></span>
                </Link>
                <div className="home-big-info">
                  <Link href={bigDeal.productId ? `/product/${bigDeal.productId}` : "/deals/big"}>{bigDeal.title}</Link>
                  <div className="home-big-prices">
                    <strong>Rs. {price.toLocaleString("en-PK")}</strong>
                    {regularPrice > price ? <s>Rs. {regularPrice.toLocaleString("en-PK")}</s> : null}
                    {saved > 0 ? <em>Save Rs. {saved.toLocaleString("en-PK")}</em> : null}
                  </div>
                  <small>Limited-time deal · Pakistan Time</small>
                  <button className="home-add" onClick={addBigDealToCart} disabled={!live || !product || stock <= 0 || price <= 0}>
                    <ShoppingCart size={14} />{stock <= 0 ? "Sold out" : !live ? "Deal unavailable" : "Add to cart"}
                  </button>
                </div>
              </article>
              <div className="home-next-deal" aria-label="Next big deal is locked">
                {nextSrc && <Image src={nextSrc} alt="" fill priority loading="eager" fetchPriority="high" unoptimized sizes="(max-width: 600px) 50vw, 600px" className="object-cover" />}
                <span><LockKeyhole size={36} /><b>LOCKED</b><small>{nextDeal?.title || "Next big deal"}</small><strong>Rs. {nextPrice.toLocaleString("en-PK")}</strong>{nextRegularPrice > nextPrice ? <small>Was Rs. {nextRegularPrice.toLocaleString("en-PK")}</small> : null}{nextSaved > 0 ? <small>Save Rs. {nextSaved.toLocaleString("en-PK")}</small> : null}</span>
              </div>
            </div>
          </section>
        )}
      </>
    );
  }

  return (
    <>
      <section id="weekly-deals" className="mx-4 mt-3 scroll-mt-4">
        <div className="mb-3 flex items-center justify-between gap-3 rounded-[22px] border border-black/8 bg-white px-4 py-3 shadow-sm sm:px-5">
          <div><p className="text-[8px] font-black uppercase tracking-[0.2em] text-[#E1352B]">Deals every day</p><h2 className="mt-0.5 text-lg font-black tracking-tight sm:text-xl">Weekly Deals</h2></div>
          <Link href="/weekly-deals" className="inline-flex shrink-0 items-center rounded-full bg-[#14140F] px-4 py-2.5 text-[9px] font-black uppercase tracking-[0.1em] text-white transition hover:bg-[#0F6A5F]">View All Deals</Link>
        </div>
        <div className="overflow-hidden rounded-[26px] border border-black/8 bg-white shadow-[0_14px_42px_rgba(20,20,15,0.09)]">
          <div className="flex gap-2 overflow-x-auto px-3 py-3.5 sm:px-5 [scrollbar-width:none]">
            {orderedDays.map(({ key, label, Icon }) => {
              const deal = weeklyDeals.find((item) => item.day === key && Number(item.dealPrice) > 0);
              const product = deal ? products[deal.productId] : undefined;
              const dealPrice = Number(deal?.dealPrice || 0);
              const savings = deal ? weeklyDealSavings(deal) : 0;
              const normalPrice = Number(deal?.normalPrice) || Number(deal?.originalPrice) || 0;
              const isLive = Boolean(deal && todayKey === key && dealPrice > 0);
              const timing = nowTick !== null ? dealTiming(key, new Date(nowTick)) : null;
              const cardClass = isLive ? "border-emerald-500 bg-white text-[#14140F] shadow-[0_12px_28px_rgba(16,185,129,0.16)]" : deal ? "border-[#E1352B]/20 bg-gradient-to-b from-[#FFF9F5] to-white text-[#14140F] shadow-[0_10px_24px_rgba(225,53,43,0.10)] hover:-translate-y-1 hover:border-[#E1352B]/45 hover:shadow-[0_14px_30px_rgba(225,53,43,0.18)]" : "border-black/7 bg-[#FCFBF8] text-[#14140F] hover:-translate-y-0.5 hover:border-[#0F6A5F]/25 hover:shadow-[0_10px_26px_rgba(20,20,15,0.08)]";
              const dealImage = normalizeImageUrl(deal?.imageUrl || "");
              return (
                <div key={key} className={"group relative min-w-[145px] flex-1 overflow-hidden rounded-[20px] border-2 text-center transition duration-200 " + cardClass}>
                  {deal && dealImage ? (
                    <Link href={`/product/${deal.productId}`} aria-label={`View ${deal.title}`} className="block">
                      <span className="relative block aspect-[4/3] w-full overflow-hidden">
                        <Image src={dealImage} alt={label} fill priority={isLive} loading={isLive ? "eager" : "lazy"} sizes="(max-width: 640px) 145px, (max-width: 1024px) 20vw, 180px" quality={72} className="object-cover transition duration-200 group-hover:scale-105" />
                        <span className="absolute left-1.5 top-1.5 rounded-full bg-[#E1352B] px-1.5 py-0.5 text-[6px] font-black uppercase tracking-[0.08em] text-white shadow-sm">{isLive ? "Sale" : label}</span>
                        {isLive && <span className="absolute bottom-1.5 left-1.5 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[6px] font-black uppercase tracking-[0.08em] text-white shadow-sm">LIVE</span>}
                        {savings > 0 && <span className="absolute right-1.5 top-1.5 z-20 rounded-md bg-[#0F6A5F] px-1.5 py-0.5 text-[7px] font-medium leading-none text-white shadow-sm">Save Rs. {savings.toLocaleString()}</span>}
                      </span>
                    </Link>
                  ) : (
                    <span className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-[#F4F4F1] text-[#0F6A5F]"><Icon size={18} strokeWidth={2.3} />{savings > 0 && <span className="absolute right-1.5 top-1.5 z-20 rounded-md bg-[#0F6A5F] px-1.5 py-0.5 text-[7px] font-medium leading-none text-white shadow-sm">Save Rs. {savings.toLocaleString()}</span>}</span>
                  )}
                  <span className="relative z-10 block px-2.5 pb-3 pt-2">
                    {deal?.productId ? (
                      <Link href={`/product/${deal.productId}`} className="block cursor-pointer">
                        <span className="block whitespace-nowrap text-[10px] font-black uppercase tracking-[0.07em] text-[#14140F]">{label.toUpperCase()}</span>
                        {!isLive && <span className="mt-1 flex items-center justify-center gap-1 text-[7px] font-black uppercase tracking-[0.04em] text-black/55"><LockKeyhole size={9} /> 🔒 Unlocks {WEEKDAY_LABELS[key]}</span>}
                        <span className="mt-1 block text-[7px] font-black uppercase tracking-[0.08em] text-[#E1352B]">Deal Price</span>
                        <span className="block text-[12px] font-black text-[#E1352B]">Rs. {dealPrice.toLocaleString()}</span>
                        <span className="mt-0.5 block text-[7px] font-black uppercase tracking-[0.08em] text-black/40">Normal Price</span>
                        <span className="block text-[9px] font-bold text-black/40 line-through">Rs. {normalPrice.toLocaleString()}</span>
                      </Link>
                    ) : <span className="block whitespace-nowrap text-[10px] font-black uppercase tracking-[0.07em] text-[#14140F]">{label.toUpperCase()}</span>}
                    {deal && <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); addDealToCart(deal); }} disabled={!product || Number((product as ProductDealFields).stock ?? 1) <= 0} className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#14140F] px-2.5 py-1.5 text-[7px] font-black uppercase tracking-[0.08em] text-white hover:bg-[#0F6A5F] disabled:cursor-not-allowed disabled:opacity-50"><ShoppingCart size={8} /> Add to Cart</button>}
                    {timing && !isLive && <span className="sr-only">Unlocks {WEEKDAY_LABELS[key]} at the next weekly cycle.</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      {bigDeal?.active && bigDeal.title && (() => {
        const product = bigDeal.productId ? products[bigDeal.productId] : undefined;
        const productData = product as ProductDealFields | undefined;
        const deal = bigDeal;
        const title = deal.title;
        const currentPrice = Number(deal.dealPrice || productData?.dealPrice || productData?.price || 0);
        const normalPrice = Number(deal.normalPrice || productData?.originalPrice || productData?.normalPrice || currentPrice);
        const savedAmount = normalPrice > currentPrice ? normalPrice - currentPrice : 0;
        const stock = Number(productData?.stock ?? productData?.quantity ?? deal.stock ?? 0);
        const productImage = normalizeImageUrl(productData?.imageUrl || deal.imageUrl || "");
        const productHref = deal.productId ? `/product/${deal.productId}` : "/deals/big";
        return (
          <section className="mx-4 mt-4 overflow-hidden rounded-[30px] border border-black/8 bg-white shadow-[0_20px_52px_rgba(20,20,15,0.12)]">
            <Link href={productHref} aria-label={`View ${title}`} className="block">
              <div className="relative w-full aspect-square overflow-hidden rounded-[26px] bg-neutral-100 shadow-inner">
                {productImage ? <Image src={productImage} alt={title} fill priority fetchPriority="high" sizes="(max-width: 768px) 100vw, 920px" quality={78} className="object-cover object-center" /> : <div className="flex h-full items-center justify-center text-sm font-black uppercase tracking-[0.18em] text-black/30">Big Deal</div>}
                <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/80 px-3 py-1.5 text-[10px] font-black text-white shadow backdrop-blur-md"><span>🔥</span> BIG DEAL OF THE DAY</div>
                {savedAmount > 0 && <div className="absolute right-3 top-3 inline-flex items-center rounded-full bg-[#0F6A5F] px-3 py-1.5 text-[11px] font-black text-white shadow">Save Rs. {savedAmount.toLocaleString()}</div>}
              </div>
            </Link>
            <div className="bg-white px-5 py-5 sm:px-8 sm:py-6">
              <Link href={productHref} className="group/title block" aria-label={`View ${title}`}><h2 className="line-clamp-2 text-2xl font-black leading-tight tracking-tight text-[#14140F] transition group-hover/title:text-[#0F6A5F] sm:text-4xl">{title}</h2></Link>
              <div className="mt-4 flex flex-wrap items-center gap-2.5"><span className="text-3xl font-black text-[#E1352B] sm:text-4xl">Rs. {currentPrice.toLocaleString()}</span>{normalPrice > currentPrice && <span className="text-sm font-bold text-black/40 line-through sm:text-base">Rs. {normalPrice.toLocaleString()}</span>}</div>
              {stock > 0 && stock <= 10 && <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/15 px-3 py-1 text-[11px] font-black text-amber-700"><span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />Only {stock} left in stock - order soon!</div>}
              <div className="mt-4"><button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); addBigDealToCart(); }} disabled={!deal.productId || !product || stock <= 0 || currentPrice <= 0} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#14140F] px-5 py-3 text-xs font-black text-white transition hover:bg-[#0F6A5F] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"><ShoppingCart size={15} /> Add to Cart</button></div>
            </div>
          </section>
        );
      })()}
    </>
  );
}
