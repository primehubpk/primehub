'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import HeroFlashBanner from '@/components/HeroFlashBanner';
import WeeklyDealStrip from '@/components/WeeklyDealStrip';
import PriceBuckets from '@/components/PriceBuckets';
import ProductGridRewards from '@/components/ProductGridRewards';
import YouTubeGuide from '@/components/YouTubeGuide';
import Footer from '@/components/Footer';

export default function HomePage() {
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
    <>
      <div className="min-h-screen bg-[#F4F4F1] text-[#14140F]">
        <Header />
        <HeroFlashBanner />
        <WeeklyDealStrip />
        <PriceBuckets selectedMaxPrice={selectedMaxPrice} wholesaleSelected={wholesaleSelected} onSelect={selectPrice} onWholesaleSelect={selectWholesale} />
        <ProductGridRewards selectedMaxPrice={selectedMaxPrice} wholesaleSelected={wholesaleSelected} />
        <YouTubeGuide />
        <Footer />
      </div>
    </>
  );
}
