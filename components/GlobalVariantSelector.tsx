'use client';

import {
  normalizeProductVariants,
  useCartStore,
  type VariantModalProduct,
} from '@/lib/cartStore';
import VariantSelectorBottomSheet from '@/components/product-detail/VariantSelectorBottomSheet';
import type { ProductVariantSelection } from '@/lib/types';
import { getEffectivePrice, getPakistanDay } from '@/lib/dealPricing';

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
  const product = useCartStore((state) => state.variantModalProduct) as GlobalProduct | null;
  const mode = useCartStore((state) => state.variantModalMode);
  const close = useCartStore((state) => state.closeVariantModal);
  const addItem = useCartStore((state) => state.addItem);

  if (!product || !mode) return null;

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

  function confirm(selection: ProductVariantSelection, quantity: number) {
    if (!product) return;

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

    for (let index = 0; index < quantity; index += 1) {
      addItem({
        id,
        productId: product.id,
        name: title,
        price: finalPrice,
        originalPrice: originalPrice || finalPrice,
        image,
        imageUrl: image,
        variant: selection,
      });
    }

    close();
    if (mode === 'buy') {
      window.location.href = '/checkout';
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
