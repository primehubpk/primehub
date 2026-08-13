'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import HeroFlashBanner from '@/components/HeroFlashBanner';
import PriceBuckets from '@/components/PriceBuckets';
import ProductGridRewards from '@/components/ProductGridRewards';
import YouTubeGuide from '@/components/YouTubeGuide';
import Footer from '@/components/Footer';

export default function HomePage() {
  const [selectedMaxPrice, setSelectedMaxPrice] = useState<number | null>(null);
  return <><div className="min-h-screen bg-[#F4F4F1] text-[#14140F]"><Header/><HeroFlashBanner/><PriceBuckets selectedMaxPrice={selectedMaxPrice} onSelect={setSelectedMaxPrice}/><ProductGridRewards selectedMaxPrice={selectedMaxPrice}/><YouTubeGuide/><Footer/></div></>;
}
