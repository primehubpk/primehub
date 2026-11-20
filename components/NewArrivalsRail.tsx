'use client';

import RetryableStorefrontImage from '@/components/RetryableStorefrontImage';
import Image from 'next/image';
import { CollectionBannerActions, CollectionBannerPhotos } from '@/components/home/CollectionBannerContent';
import { HomeProductCard } from '@/components/home/HomeCollections';
import FastProductLink from '@/components/FastProductLink';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useContinuousHomeRail } from '@/lib/useContinuousHomeRail';
import { useVisitProductOrder } from '@/lib/useVisitProductOrder';
import { ArrowRight, ShoppingCart, Sparkles } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useCartStore } from '@/lib/cartStore';
import { useSettings } from '@/lib/useSettings';
import { imageCandidatesOf, imageOf, originalOf, priceOf, productHasVariants, titleOf, type Product } from '@/components/shop/ShopTypes';
import { isDirectStorefrontImage } from '@/lib/imageUrl';
import { isWholesaleProduct } from '@/lib/wholesale';
import { isDedicatedDealProduct } from '@/lib/glassOffers';
import { makeTikTokContent, trackTikTokEvent } from '@/lib/tiktokPixel';
import { getVerifiedDealProduct } from '@/lib/verifiedDealProduct';
import { getMegaDealAvailableSizes } from '@/lib/glassOffers';
import CardSizePicker from '@/components/shop/CardSizePicker';
import '@/components/home/NewArrivalsPremium.css';

function timeOf(p: Product) {
  const value = p.createdAt || p.updatedAt;
  return typeof value?.toMillis === 'function' ? value.toMillis() : new Date(value || 0).getTime() || 0;
}

export function newestFirst(products: Product[], includeWholesale = false, glassDealShowcase?: Parameters<typeof isDedicatedDealProduct>[1]) {
  return [...products]
    .filter((p) => p.published !== false && !isDedicatedDealProduct(p, glassDealShowcase) && (includeWholesale || !isWholesaleProduct(p)))
    .sort((a, b) => timeOf(b) - timeOf(a) || b.id.localeCompare(a.id));
}

export default function NewArrivalsRail({
  initialProducts = [],
  liveUpdates = true,
  homeLayout = false,
}: {
  initialProducts?: Product[];
  liveUpdates?: boolean;
  homeLayout?: boolean;
}) {
  const { settings } = useSettings();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const homeRailRef = useRef<HTMLDivElement>(null);
  const [addedId, setAddedId] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [pickedSizes, setPickedSizes] = useState<Record<string, string>>({});
  const addItem = useCartStore((s) => s.addItem);
  const openVariantModal = useCartStore((s) => s.openVariantModal);

  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  useEffect(() => {
    if (!liveUpdates) return;
    const stop = onSnapshot(
      collection(db, 'products'),
      (snapshot) => setProducts(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Product)),
    );
    return () => stop();
  }, [liveUpdates]);

  const sortedNewest = useMemo(
    // Progressive rendering controls DOM cost; never cap actual catalogue choices.
    () => newestFirst(products, homeLayout, settings.glassDealShowcase),
    [products, homeLayout, settings.glassDealShowcase],
  );
  const { items: newest, ready } = useVisitProductOrder(sortedNewest, 'new-arrivals-home', homeRailRef, homeLayout);
  const [homeVisibleCount, setHomeVisibleCount] = useState(16);

  useEffect(() => {
    if (homeLayout) setHomeVisibleCount(16);
  }, [homeLayout, products.length]);

  const allNewestVisible = homeVisibleCount >= newest.length;
  const visibleNewest = homeLayout
    ? newest.slice(0, homeVisibleCount)
    : newest;
  const pauseAutoScroll = useContinuousHomeRail(homeRailRef, { enabled: homeLayout, itemCount: visibleNewest.length, speed: 25, startDelayMs: 8000 });
  useEffect(() => {
    if (homeLayout && homeRailRef.current) homeRailRef.current.dataset.clientMounted = 'true';
  }, [homeLayout]);
  useEffect(() => {
    if (!homeLayout || homeVisibleCount >= newest.length) return;
    const rail = homeRailRef.current;
    if (!rail) return;
    const reveal = () => {
      if (rail.scrollWidth - rail.scrollLeft - rail.clientWidth <= rail.clientWidth * 2) {
        setHomeVisibleCount(count => Math.min(newest.length, count + 16));
      }
    };
    rail.addEventListener('scroll', reveal, { passive: true });
    return () => rail.removeEventListener('scroll', reveal);
  }, [homeLayout, homeVisibleCount, newest.length]);

  function moveArrivals(direction: number) {
    pauseAutoScroll.current();
    if (direction > 0 && homeVisibleCount < newest.length) {
      setHomeVisibleCount(count => Math.min(newest.length, count + 16));
    }
    homeRailRef.current?.scrollBy({ left: direction * (homeRailRef.current.clientWidth + 10), behavior: 'smooth' });
  }
  const addProduct = async (product: Product, selectedSize = '') => {
    if (checkingId) return;
    setCheckingId(product.id);
    setActionError('');
    try {
      // New arrivals are seeded with compact catalog records. Use the same
      // fresh variant check as the other storefront Add to Cart buttons.
      const fresh = await getVerifiedDealProduct(product.id) as Product;
      const image = imageOf(fresh) || imageOf(product);
      const currentPrice = priceOf(fresh);
      if (selectedSize && !getMegaDealAvailableSizes(fresh).includes(selectedSize)) throw new Error('Selected size no longer available. Please choose another.');
      if (productHasVariants(fresh) &&
          openVariantModal({ ...fresh, price: currentPrice, image, imageUrl: image, preferredSize: selectedSize || undefined }, 'cart')) return;
      if (currentPrice <= 0) throw new Error('Product price is unavailable.');
      addItem({
        id: fresh.id,
        productId: fresh.id,
        category: String(fresh.category || ''),
        name: titleOf(fresh),
        price: currentPrice,
        originalPrice: originalOf(fresh) || currentPrice,
        image,
        imageUrl: image,
      });
      trackTikTokEvent('AddToCart', {
        contents: [makeTikTokContent({ id: fresh.id, name: titleOf(fresh), category: String(fresh.category || ''), price: currentPrice, quantity: 1 })],
        value: currentPrice,
        currency: 'PKR',
      });
      setAddedId(fresh.id);
      window.setTimeout(() => setAddedId((current) => current === fresh.id ? null : current), 1400);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not verify product options. Please retry.');
    } finally {
      setCheckingId(null);
    }
  };

  if (!newest.length) return null;

  if (homeLayout) {
    return (
      <section className="home-arrivals">
        <header className="arrivals-hero collection-banner--photos">
          <Image src="/new-arrivals-icon.webp" width={256} height={256} sizes="72px" className="arrivals-hero__art" alt="Emerald shopping bag with a gold New badge"/>
          <div className="arrivals-hero__copy"><h2>New Arrivals</h2><span>Explore new arrivals <ArrowRight size={13}/></span></div>
          <CollectionBannerPhotos products={newest}/>
          <Link href="/new-arrivals" prefetch={false} className="arrivals-hero__link" aria-label="Shop all New Arrivals"/>
          <CollectionBannerActions path="/new-arrivals" title="New Arrivals" className="arrivals-hero__controls" shareClassName="arrivals-hero__share" onPrevious={() => moveArrivals(-1)} onNext={() => moveArrivals(1)}/>
        </header>
        <div
          ref={homeRailRef}
          aria-busy={!ready}
          data-total-products={newest.length}
          data-rendered-products={visibleNewest.length}
          className="home-arrivals__rail" role="region" aria-label="Swipe New Arrivals" tabIndex={0}
        >
          {(allNewestVisible && visibleNewest.length > 1 ? [0, 1] : [0]).flatMap((copy) => visibleNewest.map((p, index) => (
            <div key={`${copy}:${p.id}`} data-loop-original={copy === 0 && index === 0 ? '' : undefined}
              data-loop-copy={copy === 1 && index === 0 ? '' : undefined} className="min-w-0">
              <HomeProductCard product={p} badgeText="New Arrival" />
            </div>
          )))}
        </div>
      </section>
    );
  }

  return (
    <section className="mt-5">
      <div className="mb-3 flex items-end justify-between px-4">
        <div>
          <div className="flex items-center gap-1 text-[#B7791F]"><Sparkles size={12}/><span className="text-[8px] font-black uppercase tracking-[.2em]">Premium Picks</span></div>
          <h2 className="mt-1 text-xl font-black">New Arrivals</h2>
        </div>
        <Link href="/new-arrivals" className="flex items-center gap-1 rounded-full bg-[#14140F] px-3 py-2 text-[9px] font-black text-white">View All <ArrowRight size={12}/></Link>
      </div>

      {actionError ? <p role="alert" className="mx-4 mb-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{actionError}</p> : null}
      <div className="flex snap-x gap-2.5 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
        {newest.map((p, index) => {
          const imageCandidates = imageCandidatesOf(p);
          const src = imageCandidates[0] || '';
          return (
            <article key={p.id} className="w-[132px] shrink-0 snap-start overflow-hidden rounded-[18px] bg-white shadow-sm ring-1 ring-black/5 sm:w-[160px]">
              <FastProductLink product={p} className="block">
                <div className="relative aspect-square overflow-hidden bg-white">
                  {src ? (
                    <RetryableStorefrontImage
                      src={src}
                      fallbackSrcs={imageCandidates.slice(1)}
                      alt={titleOf(p)}
                      fill
                      priority={index < 3}
                      loading={index < 3 ? 'eager' : 'lazy'}
                      fetchPriority={index < 3 ? 'high' : 'auto'}
                      unoptimized={isDirectStorefrontImage(src)}
                      sizes="(max-width: 640px) 132px, 160px"
                      quality={72}
                      className="object-contain object-center p-1"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[9px] text-black/30">No image</div>
                  )}
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-gradient-to-r from-[#A66A00] to-[#F6C453] px-2 py-1 text-[7px] font-black uppercase tracking-wider text-white shadow">New Arrival</span>
                </div>
              </FastProductLink>
              <div className="p-2.5">
                <FastProductLink product={p} className="block"><p className="line-clamp-2 min-h-[28px] text-[10px] font-black leading-[14px]">{titleOf(p)}</p></FastProductLink>
                <p className="mt-1 text-[11px] font-black text-[#E1352B]">Rs. {priceOf(p).toLocaleString()}</p>
                <CardSizePicker sizes={p.availableSizes} selected={pickedSizes[p.id] || ''}
                  onSelect={size => setPickedSizes(current => ({ ...current, [p.id]: size }))}
                  title={titleOf(p)} category={String(p.category || '')} disabled={checkingId === p.id}
                  className="mt-2" />
                <button type="button" onClick={() => void addProduct(p, pickedSizes[p.id] || '')} disabled={checkingId !== null} className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg bg-[#14140F] px-2 py-2 text-[9px] font-black text-white">{checkingId === p.id ? 'Checking options…' : addedId === p.id ? 'Added ✓' : <><ShoppingCart size={12}/>Add to cart</>}</button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
