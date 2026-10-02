'use client';

import { useEffect, useRef, useState } from 'react';
import HomeCollections from '@/components/home/HomeCollections';
import type { Product } from '@/components/shop/ShopTypes';

export default function HomeDiscoverDealsLazy({ products }: { products: Product[] }) {
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
      { rootMargin: '1000px 0px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="home-discover-deals-lazy">
      {ready ? (
        <HomeCollections products={products} standalone embeddedHome />
      ) : (
        <div className="min-h-[1px]" aria-hidden="true" />
      )}
    </div>
  );
}
