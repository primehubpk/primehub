'use client';

import Image from 'next/image';
import { Check, Eye, ShoppingCart, Star } from 'lucide-react';
import FastProductLink from '@/components/FastProductLink';
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
  const wholesale = isWholesaleProduct(product);
  const rating = Number(product.rating ?? product.averageRating ?? 0);
  const reviewCount = Number(product.reviewCount ?? product.reviewsCount ?? product.totalReviews ?? 0);
  const bestSeller = Boolean(product.isBestSeller ?? product.bestSeller ?? product.bestseller);
  const newArrival = Boolean(product.isNewArrival ?? product.newArrival ?? product.isNew);

  function handleAdd() {
    if (unavailable) return;
    if (hasVariants && openVariantModal({ ...product, image, imageUrl: image }, 'cart')) return;
    addProduct(product);
  }

  if (premium) {
    return (
      <article className="group overflow-hidden rounded-[18px] border border-[#E9E2D8] bg-white shadow-[0_7px_22px_rgba(56,43,27,0.075)] transition hover:-translate-y-0.5 hover:shadow-[0_11px_28px_rgba(56,43,27,0.12)] sm:rounded-[20px]">
        <FastProductLink product={product} className="block">
          <div className="relative aspect-[1.5/1] overflow-hidden bg-[#F7F2EA] sm:aspect-[1.58/1]">
            {image ? (
              <Image src={image} alt={titleOf(product)} fill priority={priority} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} sizes="(max-width: 900px) 50vw, 430px" className="object-cover transition duration-500 group-hover:scale-[1.03]" />
            ) : (
              <div className="flex h-full items-center justify-center text-[10px] font-bold text-black/25">No image</div>
            )}
            {discount > 0 && <span className="absolute left-2 top-2 rounded-full bg-[#E53935] px-2 py-1 text-[8px] font-black text-white shadow-sm">{discount}% OFF</span>}
          </div>
        </FastProductLink>
        <div className="flex min-h-[86px] items-end gap-2 px-2.5 pb-2.5 pt-2 sm:min-h-[96px] sm:px-3 sm:pb-3 sm:pt-2.5">
          <FastProductLink product={product} className="min-w-0 flex-1 self-stretch">
            <p className="line-clamp-2 min-h-[31px] text-[11px] font-extrabold leading-[15px] text-[#252018] sm:min-h-[36px] sm:text-[13px] sm:leading-[18px]">{titleOf(product)}</p>
            <div className="mt-1.5 flex flex-wrap items-baseline gap-1.5 sm:mt-2">
              <span className="text-[14px] font-black leading-none text-[#17130E] sm:text-[17px]">Rs. {price.toLocaleString()}</span>
              {original > price && <span className="text-[8px] font-semibold text-black/30 line-through sm:text-[9px]">Rs. {original.toLocaleString()}</span>}
            </div>
          </FastProductLink>
          <button type="button" disabled={unavailable} onClick={handleAdd} aria-label={unavailable ? `${titleOf(product)} unavailable` : `Add ${titleOf(product)} to cart`} className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition active:scale-95 sm:h-10 sm:w-10 ${unavailable ? 'cursor-not-allowed bg-black/5 text-black/25' : added ? 'bg-[#0F6A5F] text-white' : 'bg-[#FFF8EC] text-[#8B5A12] shadow-sm ring-1 ring-[#EAD7B6] hover:bg-[#F7E4C4]'}`}>
            {added ? <Check size={15} /> : <ShoppingCart size={15} />}
          </button>
        </div>
      </article>
    );
  }

  const badge = wholesale
    ? { label: 'Wholesale', className: 'bg-[#6C42D9] text-white' }
    : product.isFlashSale
      ? { label: discount > 0 ? `${discount}% OFF` : 'Deal', className: 'bg-[#E53935] text-white' }
      : bestSeller
        ? { label: 'Bestseller', className: 'bg-[#B77B08] text-white' }
        : newArrival
          ? { label: 'New Arrival', className: 'bg-[#0F6A5F] text-white' }
          : discount > 0
            ? { label: `${discount}% OFF`, className: 'bg-[#E53935] text-white' }
            : null;

  return (
    <article className={`group min-w-0 overflow-hidden rounded-[18px] border border-[#E7DED2] bg-white shadow-[0_6px_20px_rgba(51,42,31,0.07)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(51,42,31,0.11)] sm:rounded-[20px] ${compact ? 'w-[168px] shrink-0 snap-start sm:w-[186px]' : 'w-full'}`}>
      <FastProductLink product={product} className="block">
        <div className="relative aspect-[1.05/1] overflow-hidden bg-[#F6F1EA] sm:aspect-square">
          {image ? (
            <Image
              src={image}
              alt={titleOf(product)}
              fill
              priority={priority}
              loading={priority ? 'eager' : 'lazy'}
              fetchPriority={priority ? 'high' : 'auto'}
              sizes="(max-width: 639px) 50vw, (max-width: 1199px) 33vw, 25vw"
              className="object-cover transition duration-500 group-hover:scale-[1.035]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] font-bold text-black/25">No image</div>
          )}

          {badge && <span className={`absolute left-2 top-2 rounded-full px-2 py-1 text-[7px] font-black shadow-sm sm:text-[8px] ${badge.className}`}>{badge.label}</span>}

          <span className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-[#28231D] shadow-md ring-1 ring-black/5 backdrop-blur" aria-hidden="true">
            <Eye size={14} />
          </span>
        </div>

        <div className={dense ? 'px-2.5 pb-2 pt-2.5 sm:px-3 sm:pb-2.5' : 'p-3 pb-2'}>
          <p className="line-clamp-2 min-h-[32px] text-[10px] font-black leading-[15px] text-[#27221C] sm:min-h-[36px] sm:text-[12px] sm:leading-[18px]">{titleOf(product)}</p>

          {rating > 0 && (
            <div className="mt-1 flex items-center gap-1 text-[8px] font-bold text-black/45 sm:text-[9px]">
              <span className="inline-flex items-center gap-0.5 text-[#D7920B]"><Star size={11} fill="currentColor" /> {rating.toFixed(1)}</span>
              {reviewCount > 0 && <span>({reviewCount.toLocaleString()})</span>}
            </div>
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[14px] font-black leading-none text-[#17130E] sm:text-[17px]">Rs. {price.toLocaleString()}</span>
            {original > price && <span className="text-[8px] font-semibold text-black/30 line-through sm:text-[9px]">Rs. {original.toLocaleString()}</span>}
            {discount > 0 && <span className="rounded-md bg-[#CFF0E3] px-1.5 py-0.5 text-[7px] font-black text-[#0A6B55] sm:text-[8px]">{discount}% OFF</span>}
          </div>
        </div>
      </FastProductLink>

      <div className="px-2.5 pb-2.5 sm:px-3 sm:pb-3">
        <button
          type="button"
          disabled={unavailable}
          onClick={handleAdd}
          className={`flex w-full min-w-0 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[8px] font-black transition active:scale-[0.98] sm:text-[10px] ${unavailable ? 'cursor-not-allowed bg-black/5 text-black/25' : added ? 'bg-[#0F6A5F] text-white' : 'bg-[#075C4E] text-white hover:bg-[#064B40]'}`}
        >
          {unavailable ? 'Unavailable' : added ? <><Check size={13} /> Added to Cart</> : <><ShoppingCart size={13} /> Add to Cart</>}
        </button>
      </div>
    </article>
  );
}
