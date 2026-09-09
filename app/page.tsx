import HomePageClient from '@/components/HomePageClient';
import { getStorefrontSettingsSnapshot, getPublicCatalogSnapshot } from '@/lib/publicCatalogServer';
import type { Category, SiteSettings } from '@/lib/types';
import type { Product } from '@/components/shop/ShopTypes';

export default async function HomePage() {
  const [catalogResult, settingsResult] = await Promise.allSettled([
    getPublicCatalogSnapshot(),
    getStorefrontSettingsSnapshot(),
  ]);

  const snapshot = catalogResult.status === 'fulfilled'
    ? catalogResult.value
    : { products: [], categories: [] };
  const initialSettings = settingsResult.status === 'fulfilled'
    ? settingsResult.value
    : {};

  return (
    <HomePageClient
      initialProducts={snapshot.products as Product[]}
      initialCategories={snapshot.categories as Category[]}
      initialSettings={initialSettings as Partial<SiteSettings>}
    />
  );
}

