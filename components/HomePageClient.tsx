"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Header from "@/components/home/HomeHeader";
import HomeCollections from "@/components/home/HomeCollections";
import BigDealNextPreviewSync from "@/components/home/BigDealNextPreviewSync";
import HomeResellerTasksDirect from "@/components/home/HomeResellerTasksDirect";
import {
  HomePrimeSkills,
  HomeWholesaleVideos,
} from "@/components/home/HomeCommerceRails";
import "./home/home.css";
import "./home/WeeklyDealsHomeFix.css";
import "./home/HomeFeatureRails.css";
import "./home/HomeResellerRewards.css";
import "./home/HomeResellerTasksDirect.css";
import "./home/HomeCommerceRails.css";
import HeroFlashBanner from "@/components/HeroFlashBanner";
import CategorySwiper from "@/components/CategorySwiper";
import NewArrivalsRail from "@/components/NewArrivalsRail";
import ProductGridRewards from "@/components/ProductGridRewards";
import YouTubeGuide from "@/components/YouTubeGuide";
import Footer from "@/components/Footer";
import { cacheProductCatalog } from "@/lib/productNavigationCache";
import { SettingsProvider } from "@/lib/useSettings";
import type {
  Category,
  Product as SharedProduct,
  SiteSettings,
} from "@/lib/types";
import type { Product } from "@/components/shop/ShopTypes";

type Props = {
  initialProducts: Product[];
  initialCategories: Category[];
  initialSettings: Partial<SiteSettings>;
};

const RECOVERY_DELAYS_MS = [0, 350, 900];

export default function HomePageClient({
  initialProducts,
  initialCategories,
  initialSettings,
}: Props) {
  const [selectedMaxPrice, setSelectedMaxPrice] = useState<number | null>(null);
  const [wholesaleSelected, setWholesaleSelected] = useState(false);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [recoveringCatalog, setRecoveringCatalog] = useState(
    initialProducts.length === 0,
  );
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
        for (const delay of RECOVERY_DELAYS_MS) {
          if (delay > 0)
            await new Promise((resolve) => window.setTimeout(resolve, delay));
          if (cancelled) return;

          try {
            const response = await fetch("/api/storefront/read?type=catalog", {
              cache: "no-store",
            });
            if (!response.ok) continue;
            const data = await response.json();
            const nextProducts = Array.isArray(data?.products)
              ? (data.products as Product[])
              : [];
            const nextCategories = Array.isArray(data?.categories)
              ? (data.categories as Category[])
              : [];

            if (nextProducts.length > 0) {
              if (cancelled) return;
              setProducts(nextProducts);
              setCategories(nextCategories);
              return;
            }
          } catch (error) {
            console.warn("Homepage catalog recovery attempt failed", error);
          }
        }
      } finally {
        if (!cancelled) setRecoveringCatalog(false);
      }
    }

    void recoverCatalog();
    return () => {
      cancelled = true;
    };
  }, [initialProducts, initialCategories]);

  useEffect(() => {
    cacheProductCatalog(products);
  }, [products]);

  const selectPrice = (amount: number | null) => {
    setSelectedMaxPrice(amount);
    setWholesaleSelected(false);
  };

  const selectWholesale = () => {
    setSelectedMaxPrice(null);
    setWholesaleSelected((selected) => !selected);
  };

  return (
    <SettingsProvider initialSettings={initialSettings}>
      <div className="home-storefront">
        <Header />
        <main className="home-content">
          <h1 className="sr-only">
            PrimeHubMall — Bangles, Jewellery &amp; Wholesale Deals
          </h1>
          <CategorySwiper initialCategories={categories} liveUpdates={false} />
          <HeroFlashBanner
            homeLayout
            initialProducts={products as SharedProduct[]}
            liveUpdates={false}
          />
          <BigDealNextPreviewSync />
          <NewArrivalsRail
            homeLayout
            initialProducts={products}
            liveUpdates={false}
          />
          <HomeCollections
            products={products}
            onSelect={selectPrice}
            onWholesaleSelect={selectWholesale}
          />
          <HomeResellerTasksDirect />
          <HomeWholesaleVideos />
          <HomePrimeSkills />
          <div id="discover-deals-section">
            {(selectedMaxPrice !== null || wholesaleSelected) && (
              <div className="home-filter-status">
                <span>
                  {wholesaleSelected
                    ? "Wholesale products"
                    : `Products under Rs. ${selectedMaxPrice}`}
                </span>
                <button
                  className="home-add"
                  onClick={() => {
                    setSelectedMaxPrice(null);
                    setWholesaleSelected(false);
                  }}
                >
                  Clear filter
                </button>
              </div>
            )}
            {catalogUnavailable ? (
              <section className="mt-8 px-4 pb-6">
                <div className="rounded-[24px] border border-black/8 bg-white px-5 py-7 text-center shadow-sm">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#B7791F]">
                    Discover Deals
                  </p>
                  <h2 className="mt-1 text-xl font-black tracking-tight">
                    {recoveringCatalog
                      ? "Loading current products…"
                      : "Products are refreshing"}
                  </h2>
                  <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-black/50">
                    {recoveringCatalog
                      ? "We are reconnecting to the live catalog. This should only take a moment."
                      : "Our live catalog is temporarily refreshing. You can still browse today's deals or contact PrimeHubMall support for a product."}
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
                homeLayout
                initialProducts={products}
                liveUpdates={false}
                selectedMaxPrice={selectedMaxPrice}
                wholesaleSelected={wholesaleSelected}
              />
            )}
          </div>
        </main>
        <YouTubeGuide />
        <Footer onWholesaleSelect={selectWholesale} />
      </div>
    </SettingsProvider>
  );
}
