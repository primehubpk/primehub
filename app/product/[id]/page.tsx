import ProductDetailPageClient from '@/components/product-detail/ProductDetailPageClient';
import { notFound } from 'next/navigation';
import type { Product } from '@/components/product-detail/ProductDetailTypes';
import { getPublicProductSnapshot } from '@/lib/publicCatalogServer';

// Direct visits use this cached server snapshot. In-app opens paint from the
// catalog already on screen and do not request the product again.
// Admin changes invalidate the data tags; six hours is the fallback only.
export const revalidate = 21600;

// Generate only visited URLs, then serve subsequent visits from the route cache.
export function generateStaticParams() {
  return [];
}

export default async function ProductDetailPage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  const resolved = params;
  const id = decodeURIComponent(String(resolved.id || '')).trim();
  if (!id) notFound();
  // Let upstream errors fail regeneration so ISR keeps the last-good page.
  const result = await getPublicProductSnapshot(id);
  if (!result.product) notFound();
  const initialProduct = { ...result.product, id: String(result.product.id || id) } as Product;

  return <ProductDetailPageClient initialProduct={initialProduct} />;
}
