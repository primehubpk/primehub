'use client';

import { useState } from 'react';
// app/page.tsx
// Master homepage — imports and renders every modular section in exact
// numbered order. BottomNav (SECTION 9) is intentionally NOT rendered
// here: it's mounted once in app/layout.tsx so it persists across every
// route instead of being re-declared per page. See that file for it.

import Header from '@/components/Header';
import HeroFlashBanner from '@/components/HeroFlashBanner';
import PriceBuckets from '@/components/PriceBuckets';
import CategorySwiper from '@/components/CategorySwiper';
import ProductGrid from '@/components/ProductGrid';
import YouTubeGuide from '@/components/YouTubeGuide';
import Footer from '@/components/Footer';

export default function HomePage() {
  const [selectedMaxPrice, setSelectedMaxPrice] = useState<number | null>(null);
  return (
    <>
      <div className="min-h-screen bg-[#F4F4F1] text-[#14140F]">
      {/* SECTION 0 + SECTION 1: announcement bar, header, search, free delivery bar */}
      <Header />

      {/* SECTION 2: single daily Big Deal hero + countdown */}
      <HeroFlashBanner />

      {/* SECTION 3: price bucket filters */}
      <PriceBuckets
        selectedMaxPrice={selectedMaxPrice}
        onSelect={setSelectedMaxPrice}
      />

      {/* SECTION 4: shop by category (horizontal swipe) */}
      <CategorySwiper />

      {/* SECTION 5: "Just For You" product feed */}
      <ProductGrid selectedMaxPrice={selectedMaxPrice} />

      {/* SECTION 6: YouTube guide / tutorial video */}
      <YouTubeGuide />

      {/* SECTION 7: trust badges + footer */}
      <Footer />

      {/* SECTION 9: mobile bottom nav — rendered globally in app/layout.tsx */}
      </div>
    </>
  );
}
