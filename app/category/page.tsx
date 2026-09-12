import type { Metadata } from 'next';
import CategoryDirectory from '@/components/CategoryDirectory';

export const metadata: Metadata = {
  title: 'Shop by Category',
  description: 'Browse PrimeHubMall categories and open the products you want directly.',
  alternates: { canonical: '/category' },
};

export default function CategoriesPage() {
  return <CategoryDirectory />;
}
