import type { Metadata } from 'next';
import CategoryDirectory from '@/components/CategoryDirectory';
import { getPublicCategoriesSnapshot } from '@/lib/publicCatalogServer';
import type { Category } from '@/lib/types';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Shop by Category',
  description: 'Browse PrimeHubMall categories and open the products you want directly.',
  alternates: { canonical: '/category' },
};

export default async function CategoriesPage() {
  const result = await getPublicCategoriesSnapshot().catch(() => ({ categories: [] }));
  return <CategoryDirectory initialCategories={(result.categories || []) as Category[]} />;
}
