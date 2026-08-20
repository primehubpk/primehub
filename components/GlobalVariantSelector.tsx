'use client';

import { useCartStore, getVariantRows, type VariantModalProduct } from '@/lib/cartStore';
import VariantSelectorBottomSheet from '@/components/product-detail/VariantSelectorBottomSheet';
import type { ProductVariantSelection } from '@/lib/types';

type GlobalProduct = VariantModalProduct & {
  stock?: number;
};

function imageOf(product: GlobalProduct) {
  return product.imageUrl || product.image || product.images?.[0] || '';
}

export default function GlobalVariantSelector() {
  const product = useCartStore((state) => state.variantModalProduct) as GlobalProduct | null;
  const mode = useCartStore((state) => state.variantModalMode);
  const close = useCartStore((state) => state.closeVariantModal);
  const addItem = useCartStore((state) => state.addItem);

  if (!product || !mode) return null;

  const rows = getVariantRows(product);
  const basePrice = Number(product.price ?? 0);
  const originalPrice = Number(product.compareAtPrice ?? product.originalPrice ?? basePrice);
  const title = product.title || product.name || 'PrimeHub Deal';

  function confirm(selection: ProductVariantSelection, quantity: number) {
    const selected = rows.find(
      (row) =>
        (!selection.color || row.color === selection.color) &&
        (!selection.size || row.size === selection.size),
    );
    const price = Number(selected?.price ?? basePrice) || basePrice;
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
        price,
        originalPrice: originalPrice || price,
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
      product={product as any}
      rows={rows}
      open
      mode={mode}
      quantity={1}
      currentPrice={basePrice}
      originalPrice={originalPrice}
      onClose={close}
      onConfirm={confirm}
    />
  );
}
