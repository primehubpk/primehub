import type { Metadata } from 'next';
import { Suspense } from 'react';
import ShopCatalog from '@/components/ShopCatalog';
import ShopRouteLoading from '@/components/shop/ShopRouteLoading';

export const revalidate = 300;

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

export default function ShopPage() {
  return (
    <Suspense fallback={<ShopRouteLoading />}>
      <ShopCatalog />
    </Suspense>
  );
}
