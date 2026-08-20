'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { ShoppingCart, Sparkles } from 'lucide-react';
import { db } from '@/lib/firebase';
import { useCartStore } from '@/lib/cartStore';

type ImageValue = string | { url?: string };
type WeekendProduct = {
  id: string;
  title?: string;
  name?: string;
  price?: number | string;
  originalPrice?: number | string;
  imageUrl?: string;
  image?: string;
  images?: ImageValue[];
  productId?: string;
  variantMatrix?: any[];
  variants?: any[];
  variantColors?: any;
  variantSizes?: any;
  variantOptions?: any;
  colors?: any;
  sizes?: any;
  hasVariants?: boolean;
};
function isWeekend() { const day = new Date().getDay(); return day === 0 || day === 6; }
function titleOf(product: WeekendProduct) { return product.title || product.name || 'Weekend Deal'; }
function getDealImageUrl(deal: WeekendProduct) { const first = deal.images?.[0]; return (typeof first === 'string' ? first : first?.url) || deal.imageUrl || deal.image || '/placeholder.png'; }
function isImgBB(src: string) { try { const url = new URL(src); return url.protocol === 'https:' && (url.hostname === 'i.ibb.co' || url.hostname === 'ibb.co'); } catch { return false; } }

export default function DayDeals() {
  const [deals, setDeals] = useState<WeekendProduct[]>([]);
  const openVariantModal = useCartStore((state) => state.openVariantModal);
  const weekendActive = isWeekend();

  useEffect(() => {
    const weekendDealsQuery = query(collection(db, 'products'), where('isWeekendSpecial', '==', true));
    return onSnapshot(weekendDealsQuery, (snapshot) => setDeals(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as WeekendProduct)), () => setDeals([]));
  }, []);

  function addDeal(event: React.MouseEvent<HTMLButtonElement>, product: WeekendProduct) {
    event.preventDefault();
    event.stopPropagation();
    const dealProduct = {
      ...product,
      id: product.id,
      productId: product.productId || product.id,
      image: getDealImageUrl(product),
      imageUrl: product.imageUrl || getDealImageUrl(product),
    };
    void openVariantModal(dealProduct as any, 'cart');
  }

  if (!deals.length) return null;
  return (
    <section className="mx-auto mt-6 max-w-6xl px-4">
      <div className="mb-3 flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-[#FFB020]" aria-hidden="true"/><h2 className="font-[family-name:var(--font-display)] text-base font-bold">{weekendActive ? 'Weekend Glow Deals — Live Now' : 'Weekend Glow Deals'}</h2></div>
      <div className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto overflow-y-visible touch-pan-x touch-pan-y cursor-grab active:cursor-grabbing overscroll-x-contain scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {deals.slice(0, 3).map((deal) => {
          const price = Number(deal.price || 0); const original = Number(deal.originalPrice || 0); const discount = original > price && price > 0 ? Math.round(((original - price) / original) * 100) : 0; const image = getDealImageUrl(deal);
          return <article key={deal.id} className="relative w-[180px] shrink-0 snap-start overflow-hidden rounded-xl border border-black/10 bg-white p-2 text-center sm:w-[210px]"><Link href={`/product/${deal.id}`} className="block"><div className="mb-2 aspect-square overflow-hidden rounded-lg bg-[#F4F4F1]"><Image src={image} alt={titleOf(deal)} width={300} height={300} unoptimized={isImgBB(image)} className="h-full w-full object-cover" onError={(event)=>{event.currentTarget.src='/placeholder.png';}}/></div><p className="truncate text-[9px] font-bold">{titleOf(deal)}</p>{discount>0&&<span className="mt-1 inline-block rounded-full bg-[#E1352B] px-2 py-0.5 text-[10px] font-bold text-white">-{discount}%</span>}</Link><button type="button" onClick={(event)=>addDeal(event,deal)} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#14140F] py-2.5 text-[9px] font-black text-white"><ShoppingCart size={12}/> Add to Cart</button></article>;
        })}
      </div>
    </section>
  );
}
