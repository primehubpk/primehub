'use client';

import HomeCategoryDeals from '@/components/home/HomeCategoryDeals';
import type { Product } from '@/components/shop/ShopTypes';
import type { Category } from '@/lib/types';

// Keep this entry point for existing callers, but never gate real catalogue
// sections on client hydration or IntersectionObserver. Mobile must receive
// category banners and products in the initial server-rendered page too.
export default function HomeCategoryDealsLazy({
  products,
  categories,
}: {
  products: Product[];
  categories: Category[];
}) {
  return (
    <div className="home-category-deals-lazy">
      <HomeCategoryDeals products={products} categories={categories} />
    </div>
  );
}
