'use client';

import Link from 'next/link';
import { useState } from 'react';
import Header from '@/components/Header';
import HeroFlashBanner from '@/components/HeroFlashBanner';
import CategorySwiper from '@/components/CategorySwiper';
import PriceBuckets from '@/components/PriceBuckets';
import NewArrivalsRail from '@/components/NewArrivalsRail';
import ProductGridRewards from '@/components/ProductGridRewards';
import YouTubeGuide from '@/components/YouTubeGuide';
import Footer from '@/components/Footer';
import type { Category, Product as SharedProduct } from '@/lib/types';
import type { Product } from '@/components/shop/ShopTypes';

type Props = {
  initialProducts: Product[];
  initialCategories: Category[];
};

export default function HomePageClient({ initialProducts, initialCategories }: Props) {
  const [selectedMaxPrice, setSelectedMaxPrice] = useState<number | null>(null);
  const [wholesaleSelected, setWholesaleSelected] = useState(false);
  const catalogUnavailable = initialProducts.length === 0;

  const selectPrice = (amount: number | null) => {
    setSelectedMaxPrice(amount);
    setWholesaleSelected(false);
  };

  const selectWholesale = () => {
    setSelectedMaxPrice(null);
    setWholesaleSelected((selected) => !selected);
  };

  return (
    <div className="min-h-screen bg-[#F4F4F1] text-[#14140F]">
      <Header />
      <CategorySwiper initialCategories={initialCategories} liveUpdates={false} />
      <HeroFlashBanner initialProducts={initialProducts as SharedProduct[]} liveUpdates={false} />
      <NewArrivalsRail initialProducts={initialProducts} liveUpdates={false} />
      <PriceBuckets
        selectedMaxPrice={selectedMaxPrice}
        wholesaleSelected={wholesaleSelected}
        onSelect={selectPrice}
        onWholesaleSelect={selectWholesale}
      />
      <div id="discover-deals-section">
        {catalogUnavailable ? (
          <section className="mt-8 px-4 pb-6">
            <div className="rounded-[24px] border border-black/8 bg-white px-5 py-7 text-center shadow-sm">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#B7791F]">Discover Deals</p>
              <h2 className="mt-1 text-xl font-black tracking-tight">Products are refreshing</h2>
              <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-black/50">
                Our live catalog is temporarily refreshing. You can still browse today&apos;s deals or contact PrimeHubMall support for a product.
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <Link
                  href="/weekly-deals"
                  className="rounded-full bg-[#14140F] px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.08em] text-white"
                >
                  View Today&apos;s Deals
                </Link>
                <a
                  href="https://wa.me/923238878009"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-[#25D366] px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.08em] text-white"
                >
                  Ask on WhatsApp
                </a>
              </div>
            </div>
          </section>
        ) : (
          <ProductGridRewards
            initialProducts={initialProducts}
            liveUpdates={false}
            selectedMaxPrice={selectedMaxPrice}
            wholesaleSelected={wholesaleSelected}
          />
        )}
      </div>
      <YouTubeGuide />
      <Footer onWholesaleSelect={selectWholesale} />
    </div>
  );
}
