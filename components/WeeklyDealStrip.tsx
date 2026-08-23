'use client';

import { useEffect, useState, type MouseEvent } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { ArrowRight, Clock3, ShoppingBag } from 'lucide-react';
import type { WeeklyDeal } from '@/lib/types';
import { weeklyDealSavings } from '@/lib/weeklyDealUtils';
import { useCartStore, type VariantModalProduct } from '@/lib/cartStore';

type DealProduct = VariantModalProduct & {
  stock?: number;
  quantity?: number;
  inventory?: number;
  options?: unknown[];
};

const DAYS: WeeklyDeal['day'][] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_LABELS: Record<WeeklyDeal['day'], string> = {
  sunday: 'Sunday', monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday',
};

function getToday(): WeeklyDeal['day'] { return DAYS[new Date().getDay()]; }

function hasVariants(product: DealProduct): boolean {
  return Boolean(
    (Array.isArray(product.variants) && product.variants.length > 0) ||
    (Array.isArray(product.options) && product.options.length > 0) ||
    (Array.isArray(product.variantOptions) && product.variantOptions.length > 0) ||
    product.hasVariants,
  );
}

function getProductImage(product: any): string {
  if (!product) return '';
  if (typeof product.image === 'string' && product.image) return product.image;
  if (typeof product.imageUrl === 'string' && product.imageUrl) return product.imageUrl;
  const first = product.images?.[0];
  if (typeof first === 'string') return first;
  if (first && typeof first === 'object') {
    return String((first as any).url || (first as any).src || '');
  }
  return '';
}

function numericPrice(value: unknown): number {
  const parsed = Number(String(value ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function WeeklyDealStrip() {
  const [deals, setDeals] = useState<WeeklyDeal[]>([]);
  const [loadingDealId, setLoadingDealId] = useState<string | null>(null);
  const today = getToday();
  const addItem = useCartStore((state) => state.addItem);
  const openVariantModal = useCartStore((state) => state.openVariantModal);

  useEffect(() => onSnapshot(doc(db, 'settings', 'main'), (snap) => {
    if (!snap.exists()) { setDeals([]); return; }
    const raw = snap.data().weeklyDeals;
    setDeals(Array.isArray(raw) ? (raw as WeeklyDeal[]) : []);
  }), []);

  const orderedDeals = DAYS
    .map((day) => deals.find((deal) => deal.day === day))
    .filter((deal): deal is WeeklyDeal => Boolean(deal));

  if (!orderedDeals.some((deal) => deal.active)) return null;

  async function handleDealAddToCart(e: MouseEvent, deal: WeeklyDeal) {
    e.preventDefault();
    e.stopPropagation();

    const targetId = deal.productId || deal.id;
    if (!targetId) return;

    setLoadingDealId(deal.id || targetId);
    try {
      const snap = await getDoc(doc(db, 'products', targetId));
      const fullProduct = snap.exists() ? { id: snap.id, ...snap.data() } : deal;
      const product = fullProduct as DealProduct;
      const image = getProductImage(product);
      const productPrice = numericPrice((product as any).price);
      const dealPrice = numericPrice(deal.dealPrice || (product as any).dealPrice || productPrice);
      const originalPrice = numericPrice(
        deal.originalPrice ||
        (product as any).normalPrice ||
        product.originalPrice ||
        product.compareAtPrice ||
        productPrice ||
        dealPrice,
      );
      const productWithDealPrice: DealProduct = {
        ...product,
        price: dealPrice,
        originalPrice: originalPrice || dealPrice,
        image,
        imageUrl: image,
      };

      if (hasVariants(productWithDealPrice) && typeof openVariantModal === 'function') {
        openVariantModal(productWithDealPrice, 'cart');
        return;
      }

      addItem({
        id: productWithDealPrice.id,
        name: productWithDealPrice.title || productWithDealPrice.name || deal.title || 'PrimeHub Deal',
        price: dealPrice,
        originalPrice: originalPrice || dealPrice,
        image,
        imageUrl: image,
        dealDay: deal.day,
      });
    } catch (error) {
      console.error('Error fetching deal product variants:', error);
    } finally {
      setLoadingDealId(null);
    }
  }

  return (
    <section className="px-4 py-5 md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[.22em] text-[#E1352B]">Weekly Glow Deals</p>
            <h2 className="mt-1 text-xl font-black">Every day, a new reason to shop.</h2>
          </div>
        </div>
        <div className="flex gap-3 overflow-x-auto overflow-y-visible touch-pan-x touch-pan-y cursor-grab active:cursor-grabbing snap-x snap-mandatory overscroll-x-contain scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {orderedDeals.map((deal) => {
            if (!deal.active) return null;
            const dayLabel = DAY_LABELS[deal.day];
            const href = deal.productId ? `/product/${deal.productId}` : (deal.buttonLink || '/shop');
            const isLoading = loadingDealId === (deal.id || deal.productId);
            const savings = weeklyDealSavings(deal);
            return (
              <article key={deal.id || deal.day} className={`min-w-[180px] shrink-0 snap-start overflow-hidden rounded-[24px] bg-white shadow-sm ${deal.day === today ? 'ring-2 ring-[#E1352B]' : ''}`}>
                <Link href={href} className="block">
                  <div className="relative h-28 bg-[#14140F]">
                    {deal.imageUrl && <img src={deal.imageUrl} alt={deal.title || `${dayLabel} Deal`} className="h-full w-full object-cover opacity-85" draggable={false} />}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                    <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-[#FFB020] px-2 py-1 text-[7px] font-black">{dayLabel}</span>
                    {deal.day === today && <span className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-[#E1352B] px-2 py-1 text-[7px] font-black text-white">TODAY</span>}
                    {savings > 0 && (
                      <span className="pointer-events-none absolute right-2 top-2 z-10 rounded-md bg-[#0F6A5F] px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                        Save Rs. {savings.toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#E1352B]">{dayLabel.toUpperCase()} DEAL</p>
                    <p className="mt-1 truncate text-[10px] font-black">{deal.title || `${dayLabel} Deal`}</p>
                    <div className="mt-1 flex items-center gap-2">
                      {deal.originalPrice > 0 && <span className="text-[8px] text-black/30 line-through">Rs. {deal.originalPrice}</span>}
                      {deal.dealPrice > 0 && <b className="font-[family-name:var(--font-mono)] text-sm">Rs. {deal.dealPrice}</b>}
                    </div>
                    <p className="mt-2 flex items-center gap-1 text-[7px] font-bold text-black/40"><Clock3 size={10} />{deal.endAt && !Number.isNaN(new Date(deal.endAt).getTime()) ? `Ends ${new Date(deal.endAt).toLocaleString()}` : 'Limited time'}</p>
                  </div>
                </Link>
                {deal.productId && (
                  <div className="px-3 pb-3">
                    <button type="button" onClick={(e) => handleDealAddToCart(e, deal)} disabled={isLoading} className="flex w-full items-center justify-center gap-1 rounded-xl bg-[#14140F] px-2 py-2.5 text-[8px] font-black text-white disabled:opacity-50">
                      <ShoppingBag size={11} />{isLoading ? 'LOADING...' : 'ADD TO CART'}
                    </button>
                    <Link href={href} className="mt-2 flex items-center justify-center gap-1 text-[8px] font-black text-[#E1352B]">{deal.buttonText || 'View Deal'} <ArrowRight size={10} /></Link>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
