import { normalizeProductVariants, type VariantModalProduct } from '@/lib/cartStore';

/**
 * Compact home/catalog records intentionally omit variantMatrix. Never mistake
 * a compact record for a real no-variant product on an Add to Cart action.
 * This one-product, no-store read is done only when the customer taps Add.
 */
export async function getVerifiedDealProduct(productId: string): Promise<VariantModalProduct> {
  if (!productId) throw new Error('Product is unavailable.');
  const response = await fetch(
    `/api/storefront/read?type=product&id=${encodeURIComponent(productId)}`,
    { cache: 'no-store' },
  );
  if (!response.ok) throw new Error('Could not verify product options. Please retry.');
  const result = await response.json();
  const product = result?.product as VariantModalProduct | undefined;
  if (!product || String(product.id) !== productId) {
    throw new Error('Product options are temporarily unavailable. Please retry.');
  }
  const sourceRows = [
    ...(Array.isArray(product.variantMatrix) ? product.variantMatrix : []),
    ...(Array.isArray(product.variants) ? product.variants : []),
  ];
  if (sourceRows.length > 0 && !normalizeProductVariants(product).hasVariants) {
    throw new Error('This product has no selectable in-stock variants.');
  }
  const rawStock = product.stock ?? product.quantity ?? product.inventory;
  // Do not turn an explicitly stored zero into the default stock of 30.
  const parentStock = rawStock === undefined || rawStock === null || rawStock === ''
    ? 30 : Number(rawStock);
  if (!Number.isFinite(parentStock) || parentStock <= 0) {
    throw new Error('This product is currently out of stock.');
  }
  return product;
}
