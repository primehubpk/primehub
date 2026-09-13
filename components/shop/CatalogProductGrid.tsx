'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import CatalogProductCard from './CatalogProductCard';
import { Product } from './ShopTypes';

type Props = {
  products: Product[];
  addedId: string | null;
  addProduct: (product: Product) => void;
  loading?: boolean;
  dense?: boolean;
  premium?: boolean;
};

const DEFAULT_INITIAL_COUNT = 24;
const DENSE_INITIAL_COUNT = 30;
const LOAD_BATCH_SIZE = 24;

export default function CatalogProductGrid({
  products,
  addedId,
  addProduct,
  loading,
  dense = false,
  premium = false,
}: Props) {
  const grid = premium
    ? 'grid grid-cols-2 gap-2.5 sm:gap-3'
    : dense
      ? 'grid grid-cols-3 gap-2 md:grid-cols-4'
      : 'grid grid-cols-2 gap-3 md:grid-cols-4';
  const initialCount = dense ? DENSE_INITIAL_COUNT : DEFAULT_INITIAL_COUNT;
  const [visibleCount, setVisibleCount] = useState(() => Math.min(products.length, initialCount));
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVisibleCount(Math.min(products.length, initialCount));
  }, [products, initialCount]);

  const visibleProducts = useMemo(
    () => products.slice(0, visibleCount),
    [products, visibleCount],
  );
  const hasMore = visibleCount < products.length;

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasMore || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setVisibleCount((current) => Math.min(products.length, current + LOAD_BATCH_SIZE));
      },
      { rootMargin: premium ? '1100px 0px' : '700px 0px', threshold: 0.01 },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, premium, products.length]);

  if (loading) {
    return (
      <div className={grid}>
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="aspect-[1.45/1] animate-pulse rounded-[18px] bg-white" />
        ))}
      </div>
    );
  }

  if (!products.length) {
    return (
      <div className="rounded-[28px] bg-white p-10 text-center">
        <h2 className="font-black">No products found</h2>
      </div>
    );
  }

  return (
    <>
      <div className={grid}>
        {visibleProducts.map((product, index) => (
          <CatalogProductCard
            key={product.id}
            product={product}
            addedId={addedId}
            addProduct={addProduct}
            dense={dense}
            premium={premium}
            priority={index < (premium ? 4 : 8)}
          />
        ))}
      </div>

      {hasMore && (
        <div ref={loadMoreRef} className={premium ? 'h-px w-full' : 'flex justify-center pt-5'}>
          {!premium && (
            <button
              type="button"
              onClick={() => setVisibleCount((current) => Math.min(products.length, current + LOAD_BATCH_SIZE))}
              className="rounded-full border border-black/8 bg-white px-5 py-2.5 text-[10px] font-black shadow-sm transition active:scale-[0.98]"
            >
              Load more products
            </button>
          )}
        </div>
      )}
    </>
  );
}
