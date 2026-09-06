'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
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
  const [selectedMaxPrice, setSelectedMaxPrice] = useState<number | null>(null);
  const [wholesaleSelected, setWholesaleSelected] = useState(false);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [recoveringCatalog, setRecoveringCatalog] = useState(initialProducts.length === 0);
  const catalogUnavailable = products.length === 0;

  useEffect(() => {
    if (initialProducts.length > 0) {
      setProducts(initialProducts);
      setCategories(initialCategories);
      setRecoveringCatalog(false);
      return;
    }

    let cancelled = false;
    async function recoverCatalog() {
      try {
        const [productsSnap, categoriesSnap] = await Promise.all([
          getDocs(collection(db, 'products')),
          getDocs(collection(db, 'categories')),
        ]);
        if (cancelled) return;
        const nextProducts = productsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Product));
        const nextCategories = categoriesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Category));
        setProducts(nextProducts);
        setCategories(nextCategories);
      } catch (error) {
        console.warn('Homepage client catalog recovery failed', error);
      } finally {
        if (!cancelled) setRecoveringCatalog(false);
      }
    }

    void recoverCatalog();
    return () => {
      cancelled = true;
    };
  }, [initialProducts, initialCategories]);

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
        {catalogUnavailable ? (
          <section className="mt-8 px-4 pb-6">
            <div className="rounded-[24px] border border-black/8 bg-white px-5 py-7 text-center shadow-sm">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#B7791F]">Discover Deals</p>
              <h2 className="mt-1 text-xl font-black tracking-tight">{recoveringCatalog ? 'Loading current products…' : 'Products are refreshing'}</h2>
              <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-black/50">
                {recoveringCatalog
                  ? 'We are reconnecting to the live catalog. This should only take a moment.'
                  : 'Our live catalog is temporarily refreshing. You can still browse today\'s deals or contact PrimeHubMall support for a product.'}
              </p>
              {!recoveringCatalog ? (
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
              ) : null}
            </div>
          </section>
        ) : (
          <ProductGridRewards
            initialProducts={products}
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
