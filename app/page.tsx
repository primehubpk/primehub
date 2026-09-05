import HomePageClient from '@/components/HomePageClient';
import { getPublicCatalogSnapshot } from '@/lib/publicCatalogServer';
import type { Category } from '@/lib/types';
import type { Product } from '@/components/shop/ShopTypes';

export const revalidate = 60;

export default async function HomePage() {
  const snapshot = await getPublicCatalogSnapshot();

  return (
    <HomePageClient
      initialProducts={snapshot.products as Product[]}
      initialCategories={snapshot.categories as Category[]}
    />
  );
}
