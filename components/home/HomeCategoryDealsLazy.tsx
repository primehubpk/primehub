'use client';

import { useEffect, useRef, useState } from 'react';
import HomeCategoryDeals from '@/components/home/HomeCategoryDeals';
import type { Product } from '@/components/shop/ShopTypes';
import type { Category } from '@/lib/types';

export default function HomeCategoryDealsLazy({
  products,
  categories,
}: {
  products: Product[];
  categories: Category[];
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setReady(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setReady(true);
          observer.disconnect();
        }
      },
      { rootMargin: '1200px 0px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="home-category-deals-lazy">
      {ready ? (
        <HomeCategoryDeals products={products} categories={categories} />
      ) : (
        <div className="min-h-[1px]" aria-hidden="true" />
      )}
    </div>
  );
}
