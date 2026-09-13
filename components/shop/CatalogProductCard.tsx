'use client';

import Image from 'next/image';
import { Check, ShoppingBag } from 'lucide-react';
import FastProductLink from '@/components/FastProductLink';
import WholesaleBadge from '@/components/WholesaleBadge';
import { useCartStore } from '@/lib/cartStore';
import { isWholesaleProduct } from '@/lib/wholesale';
import { Product, availableStockOf, discountOf, imageOf, originalOf, priceOf, productHasVariants, titleOf } from './ShopTypes';

type Props = {
  product: Product;
  addedId: string | null;
  addProduct: (product: Product) => void;
  compact?: boolean;
  dense?: boolean;
  premium?: boolean;
  priority?: boolean;
};

export default function CatalogProductCard({ product, addedId, addProduct, compact = false, dense = false, premium = false, priority = false }: Props) {
  const openVariantModal = useCartStore((state) => state.openVariantModal);
  const price = priceOf(product);
  const original = originalOf(product);
  const discount = discountOf(product);
  const image = imageOf(product);
  const hasVariants = productHasVariants(product);
  const stock = availableStockOf(product);
  const unavailable = stock <= 0;
  const added = addedId === product.id;

  function handleAdd() {
    if (unavailable) return;
    if (hasVariants && openVariantModal({ ...product, image, imageUrl: image }, 'cart')) return;
    addProduct(product);
  }

  if (premium) {
    return (
      <article className="group overflow-hidden rounded-[22px] border border-[#EAE4DA] bg-white shadow-[0_8px_26px_rgba(56,43,27,0.07)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(56,43,27,0.12)]">
        <FastProductLink product={product} className="block">
          <div className="relative aspect-[1.08/1] overflow-hidden bg-[#F7F2EA]">
            {image ? (
              <Image
                src={image}
                alt={titleOf(product)}
                fill
                priority={priority}
                loading={priority ? 'eager' : 'lazy'}
                fetchPriority={priority ? 'high' : 'auto'}
                sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 25vw"
                className="object-cover transition duration-500 group-hover:scale-[1.035]"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-[10px] font-bold text-black/25">No image</div>
            )}
            {discount > 0 && (
              <span className="absolute left-2 top-2 rounded-full bg-[#FFF7E8]/95 px-2 py-1 text-[8px] font-black text-[#9A650F] shadow-sm backdrop-blur">
                {discount}% OFF
              </span>
            )}
            {product.isFlashSale && (
              <span className="absolute right-2 top-2 rounded-full bg-[#14140F]/90 px-2 py-1 text-[8px] font-black text-white backdrop-blur">FLASH</span>
            )}
            {isWholesaleProduct(product) && <WholesaleBadge />}
          </div>
        </FastProductLink>
        <div className="flex min-h-[90px] items-end gap-2 p-3 pt-2.5">
          <FastProductLink product={product} className="min-w-0 flex-1 self-stretch">
            <p className="line-clamp-2 min-h-[32px] text-[11px] font-black leading-4 text-[#252018] sm:text-xs">{titleOf(product)}</p>
            <div className="mt-2 flex flex-wrap items-baseline gap-1.5">
              <span className="text-sm font-black text-[#17130E] sm:text-base">Rs. {price.toLocaleString()}</span>
              {original > price && <span className="text-[9px] font-semibold text-black/30 line-through">Rs. {original.toLocaleString()}</span>}
            </div>
          </FastProductLink>
          <button
            type="button"
            disabled={unavailable}
            onClick={handleAdd}
            aria-label={unavailable ? `${titleOf(product)} unavailable` : added ? `${titleOf(product)} added to cart` : `Add ${titleOf(product)} to cart`}
            title={unavailable ? 'Unavailable' : added ? 'Added to cart' : 'Add to cart'}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition active:scale-95 ${unavailable ? 'cursor-not-allowed bg-black/5 text-black/25' : added ? 'bg-[#0F6A5F] text-white' : 'bg-[#FFF3DF] text-[#8B5A12] ring-1 ring-[#EAD7B6] hover:bg-[#F7E4C4]'}`}
          >
            {added ? <Check size={16} /> : <ShoppingBag size={16} />}
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className={`group overflow-hidden ${dense ? 'rounded-[16px] sm:rounded-[22px]' : 'rounded-[22px]'} border border-black/6 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${compact ? 'w-[168px] shrink-0 snap-start sm:w-[186px]' : 'w-full'}`}>
      <FastProductLink product={product} className="block">
        <div className="relative aspect-square overflow-hidden bg-[#F4F4F1]">
          {image ? (
            <Image
              src={image}
              alt={titleOf(product)}
              fill
              priority={priority}
              loading={priority ? 'eager' : 'lazy'}
              fetchPriority={priority ? 'high' : 'auto'}
              sizes={dense ? '(max-width: 767px) 33vw, 25vw' : '(max-width: 767px) 50vw, 25vw'}
              className="object-cover transition duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] font-bold text-black/25">No image</div>
          )}
          {discount > 0 && <span className="absolute left-2 top-2 rounded-full bg-[#E1352B] px-2 py-1 text-[8px] font-black text-white">-{discount}%</span>}
          {product.isFlashSale && <span className="absolute right-2 top-2 rounded-full bg-[#14140F] px-2 py-1 text-[8px] font-black text-white">FLASH</span>}
          {isWholesaleProduct(product) && <WholesaleBadge />}
        </div>
        <div className={dense ? "p-2 pb-1 sm:p-3" : "p-3 pb-1"}>
          <p className={dense ? "line-clamp-2 min-h-[26px] text-[9px] font-black leading-[13px] sm:text-[11px] sm:leading-4" : "line-clamp-2 min-h-[30px] text-[11px] font-black leading-4"}>{titleOf(product)}</p>
          <div className="mt-2 flex flex-wrap items-end gap-1.5">
            <span className={dense ? "font-[family-name:var(--font-mono)] text-[10px] font-black text-[#E1352B] sm:text-sm" : "font-[family-name:var(--font-mono)] text-sm font-black text-[#E1352B]"}>Rs. {price.toLocaleString()}</span>
            {original > price && <span className="text-[9px] text-black/30 line-through">Rs. {original.toLocaleString()}</span>}
          </div>
        </div>
      </FastProductLink>
      <div className={dense ? "px-2 pb-2 pt-1.5 sm:px-3 sm:pb-3" : "px-3 pb-3 pt-2"}>
        <button
          type="button"
          disabled={unavailable}
          onClick={handleAdd}
          className={`flex w-full min-w-0 items-center justify-center gap-1.5 rounded-xl py-2 text-[8px] sm:py-2.5 sm:text-[9px] font-black transition active:scale-[0.98] ${unavailable ? 'cursor-not-allowed bg-black/5 text-black/25' : added ? 'bg-[#0F6A5F] text-white' : 'bg-[#14140F] text-white hover:bg-[#E1352B]'}`}
        >
          {unavailable ? 'Unavailable' : added ? <><Check size={13} />Added to Cart</> : <><ShoppingBag size={13} />Add to Cart</>}
        </button>
      </div>
    </article>
  );
}
