'use client';

import { useEffect } from 'react';
import { cacheProductCatalog } from '@/lib/productNavigationCache';

type CacheableProduct = { id?: unknown; [key: string]: unknown };

export default function ProductNavigationSeed({ products }: { products: unknown[] }) {
  useEffect(() => {
    cacheProductCatalog(products as CacheableProduct[]);
  }, [products]);

  return null;
}
