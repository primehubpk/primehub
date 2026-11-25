import type { Metadata } from 'next';
import { Suspense } from 'react';
import NewArrivalsCatalog from './NewArrivalsCatalog';
import { SettingsProvider } from '@/lib/useSettings';
import {
  compactPublicCatalogSnapshot,
  getPublicCatalogSnapshot,
  getStorefrontSettingsSnapshot,
} from '@/lib/publicCatalogServer';
import type { Product, Category } from '@/components/shop/ShopTypes';
import type { SiteSettings } from '@/lib/types';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'New Arrivals | PrimeHubMall',
  description: 'Explore all newly added PrimeHubMall products in order from newest to oldest.',
  alternates: { canonical: '/new-arrivals' },
};

async function NewArrivalsWithCatalog() {
  const [catalogResult, settingsResult] = await Promise.allSettled([
    getPublicCatalogSnapshot(),
    getStorefrontSettingsSnapshot(),
  ]);
  const catalog = catalogResult.status === 'fulfilled'
    ? compactPublicCatalogSnapshot(catalogResult.value)
    : { products: [], categories: [] };
  const settings = settingsResult.status === 'fulfilled' ? settingsResult.value : {};

  return (
    <SettingsProvider initialSettings={settings as Partial<SiteSettings>}>
      <NewArrivalsCatalog
        initialProducts={catalog.products as Product[]}
        initialCategories={catalog.categories as Category[]}
      />
    </SettingsProvider>
  );
}

export default function NewArrivalsPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#F4F4F1] p-6 font-black">Loading new arrivals...</main>}>
      <NewArrivalsWithCatalog />
    </Suspense>
  );
}
