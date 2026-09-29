'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, LockKeyhole, ShoppingCart } from 'lucide-react';
import { bigDealConfiguredSlotCount, bigDealRotationIndex } from '@/lib/bigDealRotation';
import { normalizeImageUrl } from '@/lib/imageUrl';
import { useCartStore } from '@/lib/cartStore';
import type { SiteSettings } from '@/lib/types';
import type { Product } from '@/components/shop/ShopTypes';

type BigDeal = SiteSettings['dailyDeal'];
type Slot = { productId: string; title: string; imageUrl: string; price: number; regular: number };

function slotAt(deal: NonNullable<BigDeal>, index: number): Slot {
  return {
    productId: String(deal.productIds?.[index] || deal.productId || ''),
    title: String(deal.titles?.[index] || deal.title || 'Big Deal'),
    imageUrl: normalizeImageUrl(String(deal.imageUrls?.[index] || deal.imageUrl || '')),
    price: Number(deal.dealPrices?.[index] ?? deal.dealPrice ?? 0),
    regular: Number(deal.originalPrices?.[index] ?? deal.originalPrice ?? 0),
  };
}

export default function BigDealLanding({ deal, products }: { deal?: BigDeal; products: Product[] }) {
  const [now, setNow] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const addItem = useCartStore((state) => state.addItem);
  const openVariantModal = useCartStore((state) => state.openVariantModal);
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const count = bigDealConfiguredSlotCount(deal);
  const current = now === null ? 0 : bigDealRotationIndex(deal?.rotationStartedAt, new Date(now), count);
  const active = deal ? slotAt(deal, current) : null;
  const locked = deal ? Array.from({ length: count - 1 }, (_, offset) => slotAt(deal, (current + offset + 1) % count)) : [];
  const start = deal?.startAt ? new Date(deal.startAt).getTime() : 0;
  const end = deal?.endAt ? new Date(deal.endAt).getTime() : 0;
  const live = now !== null && deal?.active === true && (!start || now >= start) && (!end || now < end);

  async function addActive() {
    if (!live || !active?.productId || active.price <= 0 || adding) return;
    setAdding(true);
    try {
      const fallback = products.find((item) => item.id === active.productId);
      const result = await fetch(`/api/storefront/read?type=product&id=${encodeURIComponent(active.productId)}`, { cache: 'no-store' })
        .then((response) => response.ok ? response.json() : null)
        .catch(() => null);
      const product = (result?.product || fallback) as Product | undefined;
      if (!product || Number(product.stock ?? product.quantity ?? 1) <= 0) return;
      const image = active.imageUrl || product.imageUrl || '';
      const priced = { ...product, price: active.price, originalPrice: active.regular, image, imageUrl: image };
      if (openVariantModal(priced, 'cart')) return;
      addItem({ id: product.id, productId: product.id, category: String(product.category || ''), name: active.title,
        price: active.price, originalPrice: active.regular || active.price, image, imageUrl: image });
    } catch (error) {
      console.warn('Big Deal product read unavailable', error);
    } finally {
      setAdding(false);
    }
  }

  return <main className="mx-auto max-w-6xl px-4 pb-10 pt-5">
    <Link href="/" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold"><ArrowLeft size={14}/> Back to Home</Link>
    <header className="mt-5 rounded-[28px] bg-[#14140F] p-6 text-white">
      <p className="text-[10px] font-black uppercase tracking-widest text-[#FFB020]">PrimeHubMall</p>
      <h1 className="mt-1 text-3xl font-black">Big Deal</h1>
      <p className="mt-2 text-sm text-white/60">Today&apos;s offer and the upcoming locked deals.</p>
    </header>
    {deal?.active && active ? <>
      <article className="mt-5 grid overflow-hidden rounded-[28px] bg-white shadow-sm md:grid-cols-2">
        <div className="relative aspect-square bg-[#F4F4F1]">
          {active.imageUrl && <Image src={active.imageUrl} alt={active.title} fill priority unoptimized sizes="(max-width: 768px) 100vw, 50vw" className="object-cover"/>}
          <span className="absolute left-4 top-4 rounded-full bg-[#E1352B] px-3 py-1.5 text-xs font-black text-white">{live ? '● LIVE BIG DEAL' : 'SCHEDULED BIG DEAL'}</span>
        </div>
        <div className="flex flex-col justify-center p-6 md:p-10">
          <h2 className="text-2xl font-black">{active.title}</h2>
          <p className="mt-5 text-3xl font-black text-[#E1352B]">Rs. {active.price.toLocaleString('en-PK')}</p>
          {active.regular > active.price && <s className="mt-1 text-sm text-black/40">Rs. {active.regular.toLocaleString('en-PK')}</s>}
          <button type="button" onClick={() => void addActive()} disabled={!live || adding || !active.productId || active.price <= 0} className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-[#0F6A5F] px-5 py-3 text-sm font-bold text-white disabled:opacity-50"><ShoppingCart size={16}/>{adding ? 'Adding…' : live ? 'Add Big Deal to cart' : 'Deal unavailable'}</button>
          {live && active.productId && <Link href={`/product/${encodeURIComponent(active.productId)}?deal=big`} className="mt-3 text-center text-xs font-bold text-[#0F6A5F]">View details and variants →</Link>}
        </div>
      </article>
      {locked.length > 0 && <section className="mt-8" aria-label="Upcoming locked Big Deals">
        <h2 className="mb-4 text-xl font-black">Upcoming locked deals</h2>
        <div className="flex snap-x gap-3 overflow-x-auto pb-3 [scrollbar-width:none]">
          {locked.map((slot, index) => <article key={`${slot.productId}-${index}`} className="w-[170px] shrink-0 snap-start overflow-hidden rounded-[22px] border border-[#DCCCA8] bg-white sm:w-[220px]">
            <div className="relative aspect-square overflow-hidden bg-[#EAE6DE]">
              {slot.imageUrl && <Image src={slot.imageUrl} alt="" fill unoptimized sizes="220px" loading="lazy" className="object-cover blur-md brightness-75"/>}
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/25 text-center text-white"><LockKeyhole size={26}/><b>LOCKED</b><small>Upcoming Big Deal</small></span>
            </div>
            <div className="p-3"><h3 className="line-clamp-2 text-xs font-bold">{slot.title}</h3><strong className="mt-2 block text-sm text-[#E1352B]">Rs. {slot.price.toLocaleString('en-PK')}</strong></div>
          </article>)}
        </div>
      </section>}
    </> : <p className="mt-5 rounded-[24px] bg-white p-6 text-sm font-bold">Big Deal is currently unavailable.</p>}
  </main>;
}
