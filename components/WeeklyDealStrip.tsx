'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { ArrowRight, Clock3, ShoppingCart } from 'lucide-react';
import type { WeeklyDeal } from '@/lib/types';
import { useCartStore } from '@/lib/cartStore';

const DAYS: WeeklyDeal['day'][] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_LABELS: Record<WeeklyDeal['day'], string> = { sunday: 'Sunday', monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday' };
function getToday(): WeeklyDeal['day'] { return DAYS[new Date().getDay()]; }

type WeeklyDealProduct = WeeklyDeal & {
  name?: string;
  price?: number;
  image?: string;
  images?: Array<string | { url?: string }>;
  variants?: any[];
  variantColors?: any;
  variantSizes?: any;
  hasVariants?: boolean;
};

function imageOf(deal: WeeklyDealProduct) {
  const first = deal.images?.[0];
  return (typeof first === 'string' ? first : first?.url) || deal.imageUrl || deal.image || '';
}

export default function WeeklyDealStrip() {
  const [deals, setDeals] = useState<WeeklyDeal[]>([]);
  const today = getToday();
  const addItem = useCartStore((state) => state.addItem);
  const openVariantModal = useCartStore((state) => state.openVariantModal);

  useEffect(() => onSnapshot(doc(db, 'settings', 'main'), (snap) => {
    if (!snap.exists()) { setDeals([]); return; }
    const raw = snap.data().weeklyDeals;
    setDeals(Array.isArray(raw) ? (raw as WeeklyDeal[]) : []);
  }), []);

  const orderedDeals = DAYS.map((day) => deals.find((deal) => deal.day === day)).filter((deal): deal is WeeklyDeal => Boolean(deal));
  if (!orderedDeals.some((deal) => deal.active)) return null;

  function handleAddToCart(event: React.MouseEvent<HTMLButtonElement>, deal: WeeklyDeal) {
    event.preventDefault();
    event.stopPropagation();

    const product = deal as WeeklyDealProduct;
    const hasVariants = Boolean(
      (product.variants && product.variants.length > 0) ||
      (product.variantColors && product.variantColors.length > 0) ||
      (product.variantSizes && product.variantSizes.length > 0) ||
      product.hasVariants,
    );

    if (hasVariants) {
      openVariantModal(product, 'cart');
      return;
    }

    const price = Number(product.dealPrice || product.price || 0);
    const image = imageOf(product);
    addItem({
      id: product.id,
      productId: product.productId,
      name: product.title || product.name || `${DAY_LABELS[product.day]} Deal`,
      price,
      originalPrice: Number(product.originalPrice || price),
      image,
      imageUrl: image,
    });
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
            return (
              <Link href={href} key={deal.id || deal.day} className={`min-w-[180px] shrink-0 snap-start overflow-hidden rounded-[24px] bg-white shadow-sm ${deal.day === today ? 'ring-2 ring-[#E1352B]' : ''}`}>
                <div className="relative h-28 bg-[#14140F]">
                  {deal.imageUrl && <img src={deal.imageUrl} alt={deal.title || `${dayLabel} Deal`} className="h-full w-full object-cover opacity-85" draggable={false} />}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-[#FFB020] px-2 py-1 text-[7px] font-black">{dayLabel}</span>
                  {deal.day === today && <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-[#E1352B] px-2 py-1 text-[7px] font-black text-white">TODAY</span>}
                </div>
                <div className="p-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#E1352B]">{dayLabel.toUpperCase()} DEAL</p>
                  <p className="mt-1 truncate text-[10px] font-black">{deal.title || `${dayLabel} Deal`}</p>
                  <div className="mt-1 flex items-center gap-2">{deal.originalPrice > 0 && <span className="text-[8px] text-black/30 line-through">Rs. {deal.originalPrice}</span>}{deal.dealPrice > 0 && <b className="font-[family-name:var(--font-mono)] text-sm">Rs. {deal.dealPrice}</b>}</div>
                  <p className="mt-2 flex items-center gap-1 text-[7px] font-bold text-black/40"><Clock3 size={10} />{deal.endAt && !Number.isNaN(new Date(deal.endAt).getTime()) ? `Ends ${new Date(deal.endAt).toLocaleString()}` : 'Limited time'}</p>
                  <span className="mt-2 flex items-center gap-1 text-[8px] font-black text-[#E1352B]">{deal.buttonText || 'View Deal'} <ArrowRight size={10} /></span>
                  {deal.productId && <button type="button" onClick={(event) => handleAddToCart(event, deal)} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#14140F] py-2.5 text-[9px] font-black text-white"><ShoppingCart size={12} /> Add to Cart</button>}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
