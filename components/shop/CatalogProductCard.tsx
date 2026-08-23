'use client';

import Link from 'next/link';
import { Check, ShoppingBag } from 'lucide-react';
import WholesaleBadge from '@/components/WholesaleBadge';
import { useCartStore } from '@/lib/cartStore';
import { Product, availableStockOf, discountOf, imageOf, originalOf, priceOf, productHasVariants, titleOf } from './ShopTypes';

type Props = {
  product: Product;
  addedId: string | null;
  addProduct: (product: Product) => void;
  compact?: boolean;
};

export default function CatalogProductCard({ product, addedId, addProduct, compact = false }: Props) {
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

  return (
    <article className={`group overflow-hidden rounded-[22px] border border-black/6 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${compact ? 'w-[168px] shrink-0 snap-start sm:w-[186px]' : 'w-full'}`}>
      <Link href={`/product/${product.id}`} className="block">
        <div className="relative aspect-square overflow-hidden bg-[#F4F4F1]">
          {image ? (
            <img src={image} alt={titleOf(product)} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] font-bold text-black/25">No image</div>
          )}
          {discount > 0 && <span className="absolute left-2 top-2 rounded-full bg-[#E1352B] px-2 py-1 text-[8px] font-black text-white">-{discount}%</span>}
          {product.isFlashSale && <span className="absolute right-2 top-2 rounded-full bg-[#14140F] px-2 py-1 text-[8px] font-black text-white">FLASH</span>}
          {product.isWholesale && <WholesaleBadge />}
        </div>
        <div className="p-3 pb-1">
          <p className="line-clamp-2 min-h-[30px] text-[11px] font-black leading-4">{titleOf(product)}</p>
          <div className="mt-2 flex flex-wrap items-end gap-1.5">
            <span className="font-[family-name:var(--font-mono)] text-sm font-black text-[#E1352B]">Rs. {price.toLocaleString()}</span>
            {original > price && <span className="text-[9px] text-black/30 line-through">Rs. {original.toLocaleString()}</span>}
          </div>
        </div>
      </Link>
      <div className="px-3 pb-3 pt-2">
        <button
          type="button"
          disabled={unavailable}
          onClick={handleAdd}
          className={`flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-[9px] font-black transition active:scale-[0.98] ${unavailable ? 'cursor-not-allowed bg-black/5 text-black/25' : added ? 'bg-[#0F6A5F] text-white' : 'bg-[#14140F] text-white hover:bg-[#E1352B]'}`}
        >
          {unavailable ? 'Unavailable' : added ? <><Check size={13} />Added to Cart</> : <><ShoppingBag size={13} />{hasVariants ? 'Select Options' : 'Add to Cart'}</>}
        </button>
      </div>
    </article>
  );
}
