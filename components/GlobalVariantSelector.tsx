'use client';

import { useRouter } from 'next/navigation';

import {
  normalizeProductVariants,
  useCartStore,
  type VariantModalProduct,
} from '@/lib/cartStore';
import VariantSelectorBottomSheet from '@/components/product-detail/VariantSelectorBottomSheet';
import type { MarkedProductImage, ProductVariantSelection } from '@/lib/types';
import { getPakistanDay } from '@/lib/dealPricing';
import { makeTikTokContent, trackTikTokEvent } from '@/lib/tiktokPixel';

type GlobalProduct = VariantModalProduct & {
  stock?: number;
  dealPrice?: number | string;
  dealDay?: string;
  bigDealActive?: boolean;
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
  const product = useCartStore((state) => state.variantModalProduct) as GlobalProduct | null;
  const mode = useCartStore((state) => state.variantModalMode);
  const close = useCartStore((state) => state.closeVariantModal);
  const addItem = useCartStore((state) => state.addItem);

  if (!product || !mode) return null;

  const normalized = normalizeProductVariants(product);
  const rows = normalized.rows;
  const basePrice = Number(product.price ?? 0);
  const originalPrice = Number(product.compareAtPrice ?? product.originalPrice ?? basePrice);
  // Deal buttons already pass their verified active-day price. Comparison
  // prices alone must never turn a normal variant into a special deal.
  const today = getPakistanDay();
  const activeDealDay = product.dealDay && product.dealDay.toLowerCase() === today.toLowerCase()
    ? product.dealDay : undefined;
  // Preserve existing marked-down product pricing (Sale Mela etc.) even when
  // a variant has its own old regular price.
  const isSpecialPrice = product.bigDealActive === true || Boolean(activeDealDay) ||
    originalPrice > basePrice;
  const effectiveProductPrice = basePrice;
  const title = product.title || product.name || 'PrimeHub Deal';

  function confirm(selection: ProductVariantSelection, quantity: number, markedImages: MarkedProductImage[] = []) {
    if (!product) return;

    const selected = rows.find(
      (row) =>
        (!selection.color || row.color === selection.color) &&
        (!selection.size || row.size === selection.size),
    );
    const variantPrice = Number(selected?.price ?? basePrice) || basePrice;
    const finalPrice = isSpecialPrice ? basePrice : variantPrice;
    const image = String(markedImages[0]?.markedUrl || selected?.imageUrl || imageOf(product));
    const variantIdentity = Object.entries(selection)
      .filter(([, value]) => Boolean(value))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${value}`)
      .join('|');
    const id = `${product.id}:${variantIdentity}`;

    for (let index = 0; index < quantity; index += 1) {
      addItem({
        id,
        productId: product.id,
        category: String(product.category || ''),
        name: title,
        price: finalPrice,
        originalPrice: originalPrice || finalPrice,
        image,
        imageUrl: image,
        variant: selection,
        ...(activeDealDay ? { dealDay: activeDealDay as import('@/lib/types').Weekday } : {}),
        markedImages,
      });
    }

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
      // Keep the WebView and mounted storefront alive (no full document reload).
      router.push('/checkout');
    }
  }

  return (
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
  );
}
