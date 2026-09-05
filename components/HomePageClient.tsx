'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import HeroFlashBanner from '@/components/HeroFlashBanner';
import CategorySwiper from '@/components/CategorySwiper';
import PriceBuckets from '@/components/PriceBuckets';
import NewArrivalsRail from '@/components/NewArrivalsRail';
import ProductGridRewards from '@/components/ProductGridRewards';
import YouTubeGuide from '@/components/YouTubeGuide';
import Footer from '@/components/Footer';
import type { Category } from '@/lib/types';
import type { Product } from '@/components/shop/ShopTypes';

type Props = {
  initialProducts: Product[];
  initialCategories: Category[];
};

export default function HomePageClient({ initialProducts, initialCategories }: Props) {
  const [selectedMaxPrice, setSelectedMaxPrice] = useState<number | null>(null);
  const [wholesaleSelected, setWholesaleSelected] = useState(false);

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
      <CategorySwiper initialCategories={initialCategories} />
      <HeroFlashBanner />
      <NewArrivalsRail initialProducts={initialProducts} />
      <PriceBuckets
        selectedMaxPrice={selectedMaxPrice}
        wholesaleSelected={wholesaleSelected}
        onSelect={selectPrice}
        onWholesaleSelect={selectWholesale}
      />
      <div id="discover-deals-section">
        <ProductGridRewards
          initialProducts={initialProducts}
          selectedMaxPrice={selectedMaxPrice}
          wholesaleSelected={wholesaleSelected}
        />
      </div>
      <YouTubeGuide />
      <Footer onWholesaleSelect={selectWholesale} />
    </div>
  );
}
