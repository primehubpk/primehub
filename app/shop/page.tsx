import type { Metadata } from 'next';
import { Suspense } from 'react';
import ShopCatalog from '@/components/ShopCatalog';
import { getPublicCatalogSnapshot } from '@/lib/publicCatalogServer';

export const metadata: Metadata = {
  title: 'Shop Bangles, Jewellery, Watches & Wholesale Deals',
  description:
    'Browse PrimeHubMall products including bangles, jewellery, watches, retail offers and wholesale deals in Pakistan.',
  alternates: { canonical: '/shop' },
  openGraph: {
    title: 'Shop PrimeHubMall Products',
    description: 'Browse retail and wholesale deals from PrimeHubMall Pakistan.',
    url: '/shop',
  },
};

export default async function ShopPage() {
  const snapshot = await getPublicCatalogSnapshot();
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F4F4F1] p-8 text-center text-xs text-black/50">Loading shop...</div>}>
      <ShopCatalog initialProducts={snapshot.products} initialCategories={snapshot.categories} />
    </Suspense>
  );
}
