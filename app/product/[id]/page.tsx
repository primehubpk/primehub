import ProductDetailPageClient from '@/components/product-detail/ProductDetailPageClient';
import type { Product } from '@/components/product-detail/ProductDetailTypes';
import { getPublicProductSnapshot } from '@/lib/publicCatalogServer';

// Direct visits use this cached server snapshot. In-app opens paint from the
// catalog already on screen and do not request the product again.
export const revalidate = 600;

export default async function ProductDetailPage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  const resolved = params;
  const id = decodeURIComponent(String(resolved.id || '')).trim();
  let initialProduct: Product | null = null;

  if (id) {
    try {
      const result = await getPublicProductSnapshot(id);
      if (result.product && typeof result.product === 'object') {
        initialProduct = {
          ...result.product,
          id: String(result.product.id || id),
        } as Product;
      }
    } catch (error) {
      console.warn('Product server seed unavailable; client freshness read will recover.', error);
    }
  }

  return <ProductDetailPageClient initialProduct={initialProduct} />;
}
