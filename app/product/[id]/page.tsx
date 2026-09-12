import ProductDetailPageClient from '@/components/product-detail/ProductDetailPageClient';
import type { Product } from '@/components/product-detail/ProductDetailTypes';
import { getPublicProductSnapshot } from '@/lib/publicCatalogServer';

export const revalidate = 60;

export default async function ProductDetailPage({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}) {
  const resolved = await Promise.resolve(params);
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
