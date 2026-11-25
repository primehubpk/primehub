'use client';

import BackHomeLink from '@/components/BackHomeLink';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import { useShopCatalog } from '@/components/shop/useShopCatalog';
import CatalogProductGrid from '@/components/shop/CatalogProductGrid';
import type { Product, Category } from '@/components/shop/ShopTypes';
import { orderNewArrivals } from '@/lib/newArrivalsOrder';

export default function NewArrivalsCatalog({
  initialProducts = [],
  initialCategories = [],
}: {
  initialProducts?: Product[];
  initialCategories?: Category[];
}) {
  // This dedicated page must keep the full published catalog, including deal products.
  const shop = useShopCatalog(undefined, '', initialProducts, initialCategories, true);
  const ordered = useMemo(() => orderNewArrivals(shop.products), [shop.products]);

  return (
    <main className="min-h-screen bg-[#F4F4F1] pb-28">
      <div className="mx-auto max-w-6xl px-4 py-5">
        <div className="flex items-center gap-3">
          <BackHomeLink ariaLabel="Back to Home" className="flex h-11 w-11 touch-manipulation items-center justify-center rounded-full bg-white shadow-sm">
            <ArrowLeft size={18} />
          </BackHomeLink>
          <div>
            <p className="flex items-center gap-1 text-[8px] font-black uppercase tracking-[.2em] text-[#B7791F]">
              <Sparkles size={11} /> Premium Collection
            </p>
            <h1 className="text-xl font-black">New Arrivals</h1>
          </div>
        </div>
        <section className="mt-6" aria-label="All products in newest first order">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <span className="rounded-full bg-gradient-to-r from-[#A66A00] to-[#F6C453] px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-white">
              Newest arrivals first
            </span>
            {!shop.loading && (
              <span className="text-[10px] font-semibold text-black/55">
                {ordered.length.toLocaleString()} products · newest to oldest
              </span>
            )}
          </div>
          <CatalogProductGrid
            products={ordered}
            addedId={shop.addedId}
            addProduct={shop.addProduct}
            loading={shop.loading}
            dense
            fullPhoto
          />
        </section>
      </div>
    </main>
  );
}
