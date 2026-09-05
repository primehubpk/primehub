'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import Header from '@/components/Header';
import HeroFlashBanner from '@/components/HeroFlashBanner';
import CategorySwiper from '@/components/CategorySwiper';
import PriceBuckets from '@/components/PriceBuckets';
import NewArrivalsRail from '@/components/NewArrivalsRail';
import ProductGridRewards from '@/components/ProductGridRewards';
import YouTubeGuide from '@/components/YouTubeGuide';
import Footer from '@/components/Footer';
import { db } from '@/lib/firebase';
import type { Category, Product as SharedProduct } from '@/lib/types';
import type { Product } from '@/components/shop/ShopTypes';

type Props = {
  initialProducts: Product[];
  initialCategories: Category[];
};

export default function HomePageClient({ initialProducts, initialCategories }: Props) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [selectedMaxPrice, setSelectedMaxPrice] = useState<number | null>(null);
  const [wholesaleSelected, setWholesaleSelected] = useState(false);

  useEffect(() => {
    const stopProducts = onSnapshot(
      collection(db, 'products'),
      (snapshot) => setProducts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Product)),
      () => undefined,
    );
    const stopCategories = onSnapshot(
      collection(db, 'categories'),
      (snapshot) => setCategories(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as Category[]),
      () => undefined,
    );
    return () => {
      stopProducts();
      stopCategories();
    };
  }, []);

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
      <CategorySwiper initialCategories={categories} liveUpdates={false} />
      <HeroFlashBanner initialProducts={products as SharedProduct[]} liveUpdates={false} />
      <NewArrivalsRail initialProducts={products} liveUpdates={false} />
      <PriceBuckets
        selectedMaxPrice={selectedMaxPrice}
        wholesaleSelected={wholesaleSelected}
        onSelect={selectPrice}
        onWholesaleSelect={selectWholesale}
      />
      <div id="discover-deals-section">
        <ProductGridRewards
          initialProducts={products}
          liveUpdates={false}
          selectedMaxPrice={selectedMaxPrice}
          wholesaleSelected={wholesaleSelected}
        />
      </div>
      <YouTubeGuide />
      <Footer onWholesaleSelect={selectWholesale} />
    </div>
  );
}
