import type { Metadata } from 'next';
import { Suspense } from 'react';
import ShopCatalog from '@/components/ShopCatalog';
import ShopRouteLoading from '@/components/shop/ShopRouteLoading';
import { SettingsProvider } from '@/lib/useSettings';
import { getPublicCatalogSnapshot, getStorefrontSettingsSnapshot } from '@/lib/publicCatalogServer';
import type { SiteSettings } from '@/lib/types';
import type { Product, Category } from '@/components/shop/ShopTypes';

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

async function SeededShopCatalog() {
  const [catalogResult, settingsResult] = await Promise.allSettled([
    getPublicCatalogSnapshot(),
    getStorefrontSettingsSnapshot(),
  ]);

  const catalog = catalogResult.status === 'fulfilled'
    ? catalogResult.value
    : { products: [], categories: [] };
  const initialSettings = settingsResult.status === 'fulfilled'
    ? settingsResult.value
    : {};

  return (
    <SettingsProvider initialSettings={initialSettings as Partial<SiteSettings>}>
      <ShopCatalog
        initialProducts={catalog.products as Product[]}
        initialCategories={catalog.categories as Category[]}
      />
    </SettingsProvider>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={<ShopRouteLoading />}>
      <SeededShopCatalog />
    </Suspense>
  );
}
