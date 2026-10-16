'use client';

import { useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import type { DealCardProps } from './DealsTypes';
import { imageOf, regularPriceOf, statusLabel, statusStyles } from './DealsTypes';
import { useCartStore } from '@/lib/cartStore';
import { weeklyCartPrice } from '@/lib/weeklyCartPrice';
import { getVerifiedDealProduct } from '@/lib/verifiedDealProduct';

export default function DealCard({ deal, label, status, product, adding }: DealCardProps) {
  const addItem = useCartStore((state) => state.addItem);
  const openVariantModal = useCartStore((state) => state.openVariantModal);
  const [verifying, setVerifying] = useState(false);
  const [actionError, setActionError] = useState('');

  const regularPrice = regularPriceOf(product, deal);
  const dealPrice = Number(deal.dealPrice || 0);
  const { price: livePrice, comparison, savings, discount, live } = weeklyCartPrice(deal, product);
  const image = imageOf(product, deal);
  const title = product?.title || deal.title || `${label} Deal`;
  const stock = Number(product?.stock ?? 0);
  const canBuy = Boolean(product && stock > 0 && regularPrice > 0);
  const productHref = `/deals/${deal.day}`;

  async function handleAddToCart(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (verifying || !deal.productId) return;
    setVerifying(true);
    setActionError('');
    try {
      const fresh = await getVerifiedDealProduct(deal.productId);
      const { price, comparison: correctComparison, live: active } = weeklyCartPrice(deal, fresh);
      if (price <= 0) throw new Error('Deal price is not available.');
      const picture = imageOf(fresh as typeof product, deal);
      const priced = { ...fresh, price, originalPrice: correctComparison,
        image: picture, imageUrl: picture, ...(active ? { dealDay: deal.day } : {}) };
      if (openVariantModal(priced, 'cart')) return;
      addItem({ id: fresh.id, productId: fresh.id,
        name: String(fresh.title || fresh.name || deal.title || `${label} Deal`),
        price, originalPrice: correctComparison, image: picture,
        imageUrl: picture, dealDay: active ? deal.day : undefined });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not check product options.');
    } finally { setVerifying(false); }
  }

  return (
    <article className="group overflow-hidden rounded-[28px] border border-black/5 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.06)] transition hover:-translate-y-0.5">
      <Link href={productHref} className="block">
        <div className="relative aspect-square bg-[#F4F4F1]">
          {image ? (
            <img src={image} alt={title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs font-bold text-black/25">
              No product image
            </div>
          )}
          <div className="absolute left-3 right-3 top-3 flex items-start justify-between gap-2">
            <span className={`rounded-full border px-2.5 py-1.5 text-[8px] font-black uppercase tracking-wide ${statusStyles(status)}`}>
              {statusLabel(status)}
            </span>
            {discount > 0 && (
              <span className="rounded-full bg-[#E1352B] px-2.5 py-1.5 text-[9px] font-black text-white">
                -{discount}% · Save Rs. {savings.toLocaleString()}
              </span>
            )}
          </div>
        </div>
        <div className="p-4">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#E1352B]">{label.toUpperCase()} DEAL</p>
          <h2 className="mt-1.5 line-clamp-2 min-h-[44px] text-lg font-black">{title}</h2>
          <div className="mt-3 flex items-end gap-2">
            <span className="font-[family-name:var(--font-mono)] text-xl font-black text-[#E1352B]">
              Rs. {dealPrice > 0 ? dealPrice.toLocaleString() : '—'}
            </span>
            <span className="pb-0.5 text-xs font-bold text-[#0F6A5F]">Regular Rs. {regularPrice.toLocaleString()}</span>
            {comparison > regularPrice && <span className="pb-0.5 text-xs text-black/35 line-through">Rs. {comparison.toLocaleString()}</span>}
          </div>
          <p className="mt-1 text-[10px] text-black/40">
            {status === 'live' ? 'Special price active today.' : status === 'upcoming' ? 'Special price unlocks on this day.' : 'Special price returns next week.'}
          </p>
        </div>
      </Link>

      {actionError && <p role="alert" className="mx-4 rounded-lg bg-red-50 p-2 text-xs font-bold text-red-700">{actionError}</p>}
      <div className="mt-4 flex gap-2 px-4 pb-4">
        <button
          type="button"
          disabled={!deal.productId || livePrice <= 0 || verifying || adding}
          onClick={handleAddToCart}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#14140F] px-3 py-3 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:opacity-35"
        >
          <ShoppingBag size={14} />
          {verifying ? 'CHECKING OPTIONS…' : adding ? 'ADDED' : status === 'live' ? 'ADD TO CART' : 'SHOP NOW'}
        </button>
        <Link href={`/deals/${deal.day}`} className="inline-flex items-center justify-center rounded-xl border border-black/10 px-3 py-3 text-[10px] font-black">
          VIEW
        </Link>
      </div>
    </article>
  );
}
