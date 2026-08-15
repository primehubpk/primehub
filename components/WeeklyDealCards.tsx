'use client';

import Link from 'next/link';
import { Check, ShoppingCart } from 'lucide-react';
import type { Product, WeeklyDeal, Weekday } from '@/lib/types';
import { useCartStore } from '@/lib/cartStore';

type Props = {
  deals: WeeklyDeal[];
  products: Record<string, Product>;
  today: Weekday | null;
  onAdded?: (dealId: string) => void;
  addedId?: string | null;
};

export default function WeeklyDealCards({ deals, products, today, onAdded, addedId }: Props) {
  const addItem = useCartStore((state) => state.addItem);

  const addToCart = (deal: WeeklyDeal) => {
    const product = products[deal.productId];
    const regularPrice = Number(product?.price || deal.originalPrice || 0);
    const dealPrice = Number(deal.dealPrice || 0);
    const isLive = today === deal.day && dealPrice > 0;
    const price = isLive ? dealPrice : regularPrice;
    const image = product?.imageUrl || deal.imageUrl || '';
    if (!product || price <= 0 || Number(product.stock ?? 0) <= 0) return;
    addItem({
      id: product.id,
      name: product.title || deal.title,
      price,
      originalPrice: isLive ? Number(product.originalPrice || deal.originalPrice || price) : regularPrice,
      image: image || undefined,
      imageUrl: image || undefined,
      dealDay: isLive ? deal.day : undefined,
    });
    onAdded?.(deal.id);
  };

  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
    {deals.map((deal) => {
      const product = products[deal.productId];
      const title = product?.title || deal.title || 'Weekly Deal';
      const regularPrice = Number(product?.price || deal.originalPrice || 0);
      const dealPrice = Number(deal.dealPrice || 0);
      const isLive = today === deal.day && dealPrice > 0;
      const price = isLive ? dealPrice : regularPrice;
      const original = isLive ? Number(product?.originalPrice || deal.originalPrice || price) : regularPrice;
      const image = product?.imageUrl || deal.imageUrl || '';
      const inStock = Boolean(product && Number(product.stock ?? 0) > 0 && price > 0);
      const discount = isLive && original > price ? Math.round(((original - price) / original) * 100) : 0;
      return <article key={deal.id} className="overflow-hidden rounded-[28px] border border-black/5 bg-white shadow-sm">
        <Link href={`/product/${deal.productId}`} className="group block">
          <div className="relative aspect-square overflow-hidden bg-[#F4F4F1]">
            {image ? <img src={image} alt={title} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" /> : <div className="flex h-full items-center justify-center text-xs font-bold text-black/25">No product image</div>}
            <div className="absolute left-3 right-3 top-3 flex justify-between gap-2"><span className={`rounded-full px-2.5 py-1.5 text-[8px] font-black uppercase ${isLive ? 'bg-emerald-500 text-white' : 'bg-white/95 text-black/70'}`}>{isLive ? 'LIVE TODAY' : `${deal.day} DEAL`}</span>{discount > 0 && <span className="rounded-full bg-[#E1352B] px-2.5 py-1.5 text-[9px] font-black text-white">-{discount}%</span>}</div>
          </div>
        </Link>
        <div className="p-4">
          <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#E1352B]">{deal.day} Deal</p>
          <h3 className="mt-1.5 line-clamp-2 min-h-[40px] text-sm font-black">{title}</h3>
          <div className="mt-3 flex items-end gap-2"><span className="text-xl font-black text-[#E1352B]">Rs. {price.toLocaleString()}</span>{original > price && <span className="pb-0.5 text-xs text-black/35 line-through">Rs. {original.toLocaleString()}</span>}</div>
          <button type="button" disabled={!inStock || addedId === deal.id} onClick={() => addToCart(deal)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#14140F] px-3 py-3 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:opacity-40" aria-label={`Add ${title} to cart`}>{addedId === deal.id ? <><Check size={14}/>ADDED TO CART</> : <><ShoppingCart size={14}/>ADD TO CART</>}</button>
        </div>
      </article>;
    })}
  </div>;
}
