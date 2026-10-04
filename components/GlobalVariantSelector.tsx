'use client';

import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { navigateFromProductOverlay } from '@/lib/productOverlay';
import {
  normalizeProductVariants,
  useCartStore,
  type VariantModalProduct,
} from '@/lib/cartStore';
import VariantSelectorBottomSheet from '@/components/product-detail/VariantSelectorBottomSheet';
import type { ProductVariantSelection } from '@/lib/types';
import { getEffectivePrice, getPakistanDay } from '@/lib/dealPricing';
import { makeTikTokContent, trackTikTokEvent } from '@/lib/tiktokPixel';

type GlobalProduct = VariantModalProduct & {
  stock?: number;
  dealPrice?: number | string;
  dealDay?: string;
};

function imageOf(product?: GlobalProduct | null | any): string {
  if (!product) return '';
  if (typeof product.image === 'string' && product.image) return product.image;
  if (typeof product.imageUrl === 'string' && product.imageUrl) return product.imageUrl;
  if (Array.isArray(product.images) && product.images.length > 0) {
    const first = product.images[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object' && first.url) return first.url;
  }
  return '';
}

export default function GlobalVariantSelector() {
  const router = useRouter();
  const confirming = useRef(false);
  const error = useCartStore(state => state.cartError);
  const clearError = useCartStore(state => state.clearCartError);
  const product = useCartStore((state) => state.variantModalProduct) as GlobalProduct | null;
  const mode = useCartStore((state) => state.variantModalMode);
  const close = useCartStore((state) => state.closeVariantModal);
  const addItem = useCartStore((state) => state.addItem);

  if (!product || !mode) return error ? <div role="alert" className="fixed bottom-24 left-4 right-4 z-[160] rounded-xl bg-white p-4 text-sm text-red-700 shadow-xl">{error}<button type="button" onClick={clearError} className="ml-3 font-bold">Dismiss</button></div> : null;

  const normalized = normalizeProductVariants(product);
  const rows = normalized.rows;
  const basePrice = Number(product.price ?? 0);
  const originalPrice = Number(product.compareAtPrice ?? product.originalPrice ?? basePrice);
  const explicitDealPrice = Number(product.dealPrice ?? 0);
  const dealDay = product.dealDay || (originalPrice > basePrice ? getPakistanDay() : undefined);
  const effectiveProductPrice = getEffectivePrice(
    {
      price: explicitDealPrice > 0 ? originalPrice : basePrice,
      dealPrice: explicitDealPrice > 0 ? explicitDealPrice : basePrice,
      dealDay,
    },
    new Date(),
  );
  const title = product.title || product.name || 'PrimeHub Deal';

  async function confirm(selection: ProductVariantSelection, quantity: number) {
    if (!product || confirming.current) return;
    confirming.current = true;

    const selected = rows.find(
      (row) =>
        (!selection.color || row.color === selection.color) &&
        (!selection.size || row.size === selection.size),
    );
    const variantPrice = Number(selected?.price ?? basePrice) || basePrice;
    const price = getEffectivePrice(
      {
        price: effectiveProductPrice,
        dealPrice: effectiveProductPrice,
        dealDay: dealDay || undefined,
      },
      new Date(),
    );
    const finalPrice = dealDay ? price : variantPrice;
    const image = String(selected?.imageUrl || imageOf(product));
    const variantIdentity = Object.entries(selection)
      .filter(([, value]) => Boolean(value))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${value}`)
      .join('|');
    const id = `${product.id}:${variantIdentity}`;

    const added = await addItem({
        id,
        productId: product.id,
        category: String(product.category || ''),
        name: title,
        price: finalPrice,
        originalPrice: originalPrice || finalPrice,
        image,
        imageUrl: image,
        variant: selection,
      }, quantity);
    confirming.current = false;
    if (!added) return;

    trackTikTokEvent('AddToCart', {
      contents: [
        makeTikTokContent({
          id: product.id,
          name: title,
          category: product.category,
          price: finalPrice,
          quantity,
        }),
      ],
      value: finalPrice * quantity,
      currency: 'PKR',
    });

    close();
    if (mode === 'buy') {
      useCartStore.getState().closeDrawer();
      if (!navigateFromProductOverlay('/checkout')) router.push('/checkout');
    }
  }

  return (
    <>
    {error && <div role="alert" className="fixed left-4 right-4 top-4 z-[160] rounded-xl bg-white p-4 text-sm text-red-700 shadow-xl">{error}<button type="button" onClick={clearError} className="ml-3 font-bold">Dismiss</button></div>}
    <VariantSelectorBottomSheet
      product={product}
      rows={rows}
      open
      mode={mode}
      quantity={1}
      currentPrice={effectiveProductPrice}
      originalPrice={originalPrice}
      onClose={close}
      onConfirm={confirm}
    />
    </>
  );
}
