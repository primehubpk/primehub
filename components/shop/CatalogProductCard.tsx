'use client';

import Image from 'next/image';
import { Check, Eye, ShoppingBag, Star } from 'lucide-react';
import FastProductLink from '@/components/FastProductLink';
import WholesaleBadge from '@/components/WholesaleBadge';
import { isWholesaleProduct } from '@/lib/wholesale';
import { isDirectStorefrontImage } from '@/lib/imageUrl';
import { Product, availableStockOf, discountOf, imageOf, originalOf, priceOf, titleOf } from './ShopTypes';

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
  const price = priceOf(product);
  const original = originalOf(product);
  const discount = discountOf(product);
  const image = imageOf(product);
  const stock = availableStockOf(product);
  const unavailable = stock <= 0;
  const added = addedId === product.id;
  const rating = Math.max(0, Math.min(5, Number(product.rating || 0)));
  const reviews = Math.max(0, Number(product.reviews || product.reviewCount || 0));

  function handleAdd() {
    if (unavailable) return;
    // Always use the central addProduct path. It performs a no-store read for the
    // current product before deciding whether to open the variant selector, so a
    // stale card can never reopen deleted/old size options.
    addProduct(product);
  }

  if (premium) {
    return (
      <article className="group overflow-hidden rounded-[18px] border border-[#E9E2D8] bg-white shadow-[0_7px_22px_rgba(56,43,27,0.075)] transition hover:-translate-y-0.5 hover:shadow-[0_11px_28px_rgba(56,43,27,0.12)] sm:rounded-[20px]">
        <FastProductLink product={product} className="block">
          <div className="relative aspect-[1.5/1] overflow-hidden bg-[#F7F2EA] sm:aspect-[1.58/1]">
            {image ? (
              <Image
                src={image}
                alt={titleOf(product)}
                fill
                priority={priority}
                loading="eager"
                fetchPriority={priority ? 'high' : 'auto'}
                unoptimized={isDirectStorefrontImage(image)}
                sizes="(max-width: 900px) 50vw, 430px"
                className="object-cover transition duration-500 group-hover:scale-[1.03]"
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

        <div className="flex min-h-[86px] items-end gap-2 px-2.5 pb-2.5 pt-2 sm:min-h-[96px] sm:px-3 sm:pb-3 sm:pt-2.5">
          <FastProductLink product={product} className="min-w-0 flex-1 self-stretch">
            <p className="line-clamp-2 min-h-[31px] text-[11px] font-extrabold leading-[15px] text-[#252018] sm:min-h-[36px] sm:text-[13px] sm:leading-[18px]">
              {titleOf(product)}
            </p>
            <div className="mt-1.5 flex flex-wrap items-baseline gap-1.5 sm:mt-2">
              <span className="text-[14px] font-black leading-none text-[#17130E] sm:text-[17px]">
                Rs. {price.toLocaleString()}
              </span>
              {original > price && (
                <span className="text-[8px] font-semibold text-black/30 line-through sm:text-[9px]">
                  Rs. {original.toLocaleString()}
                </span>
              )}
            </div>
          </FastProductLink>

          <button
            type="button"
            disabled={unavailable}
            onClick={handleAdd}
            aria-label={unavailable ? `${titleOf(product)} unavailable` : added ? `${titleOf(product)} added to cart` : `Add ${titleOf(product)} to cart`}
            title={unavailable ? 'Unavailable' : added ? 'Added to cart' : 'Add to cart'}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition active:scale-95 sm:h-10 sm:w-10 ${unavailable ? 'cursor-not-allowed bg-black/5 text-black/25' : added ? 'bg-[#0F6A5F] text-white' : 'bg-[#FFF8EC] text-[#8B5A12] shadow-sm ring-1 ring-[#EAD7B6] hover:bg-[#F7E4C4]'}`}
          >
            {added ? <Check size={15} /> : <ShoppingBag size={15} />}
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className={`group flex h-full flex-col overflow-hidden ${dense ? 'rounded-[15px] sm:rounded-[20px]' : 'rounded-[22px]'} border border-[#e6ded2] bg-white shadow-[0_6px_18px_rgba(35,29,20,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(35,29,20,0.12)] ${compact ? 'w-[168px] shrink-0 snap-start sm:w-[186px]' : 'w-full'}`}>
      <FastProductLink product={product} className="block">
        <div className={`relative overflow-hidden bg-[#f3eee7] ${dense ? 'aspect-[1.38/1] sm:aspect-[1.22/1]' : 'aspect-square'}`}>
          {image ? (
            <Image
              src={image}
              alt={titleOf(product)}
              fill
              priority={priority}
              loading="eager"
              fetchPriority={priority ? 'high' : 'auto'}
              unoptimized={isDirectStorefrontImage(image)}
              sizes={dense ? '(max-width: 639px) 50vw, (max-width: 1279px) 33vw, 25vw' : '(max-width: 767px) 50vw, 25vw'}
              className="object-cover transition duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] font-bold text-black/25">No image</div>
          )}
          {discount > 0 && <span className="absolute left-2 top-2 rounded-lg bg-[#ec1626] px-2 py-1 text-[8px] font-black text-white shadow-sm sm:text-[9px]">{discount}% OFF</span>}
          {product.isFlashSale && <span className="absolute left-2 top-9 rounded-lg bg-[#c18300] px-2 py-1 text-[7px] font-black text-white">FLASH DEAL</span>}
          {isWholesaleProduct(product) && <WholesaleBadge />}
          <span className={`absolute bottom-2 right-2 flex items-center justify-center rounded-full bg-white/95 text-[#17221f] shadow-md ${dense ? 'h-7 w-7 sm:h-8 sm:w-8' : 'h-8 w-8'}`} aria-hidden="true"><Eye size={dense ? 13 : 15} /></span>
        </div>
        <div className={dense ? "px-2.5 pb-0.5 pt-2 sm:p-3" : "p-3 pb-1"}>
          <p className={dense ? "line-clamp-2 min-h-[28px] text-[10px] font-black leading-[14px] text-[#17221f] sm:min-h-[32px] sm:text-[12px] sm:leading-4" : "line-clamp-2 min-h-[30px] text-[11px] font-black leading-4"}>{titleOf(product)}</p>
          {rating > 0 && (
            <div className="mt-1 flex items-center gap-1 text-[8px] font-bold text-black/45 sm:text-[9px]">
              <span className="flex items-center text-[#e7a814]"><Star size={11} fill="currentColor" /></span>
              <span>{rating.toFixed(1)}</span>
              {reviews > 0 && <span>({reviews})</span>}
            </div>
          )}
          <div className={dense ? "mt-1.5 flex flex-wrap items-end gap-1.5 sm:mt-2" : "mt-2 flex flex-wrap items-end gap-1.5"}>
            <span className={dense ? "text-[13px] font-black leading-none text-[#062d27] sm:text-[17px]" : "font-[family-name:var(--font-mono)] text-sm font-black text-[#E1352B]"}>Rs. {price.toLocaleString()}</span>
            {original > price && <span className="text-[9px] text-black/30 line-through">Rs. {original.toLocaleString()}</span>}
            {discount > 0 && <span className="ml-auto rounded-md bg-[#cceedd] px-1.5 py-1 text-[7px] font-black text-[#075447] sm:text-[8px]">SAVE {discount}%</span>}
          </div>
        </div>
      </FastProductLink>
      <div className={dense ? "mt-auto px-2.5 pb-2 pt-1.5 sm:px-3 sm:pb-3 sm:pt-2" : "mt-auto px-3 pb-3 pt-2"}>
        <button
          type="button"
          disabled={unavailable}
          onClick={handleAdd}
          className={`flex w-full min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 text-[8px] font-black transition active:scale-[0.98] sm:text-[10px] ${dense ? 'min-h-9 py-1.5 sm:min-h-10 sm:py-2' : 'min-h-10 py-2'} ${unavailable ? 'cursor-not-allowed bg-black/5 text-black/25' : added ? 'bg-[#0F6A5F] text-white' : 'bg-[#005448] text-white hover:bg-[#063f37]'}`}
        >
          {unavailable ? 'Unavailable' : added ? <><Check size={13} />Added to Cart</> : <><ShoppingBag size={dense ? 12 : 13} />Add to Cart</>}
        </button>
      </div>
    </article>
  );
}
