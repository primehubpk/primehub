"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import Header from "@/components/home/HomeHeader";
import HomeCollections from "@/components/home/HomeCollections";
import HomeCategoryDeals from "@/components/home/HomeCategoryDeals";
import BigDealNextPreviewSync from "@/components/home/BigDealNextPreviewSync";
import {
  HomePrimeSkills,
  HomeWholesaleVideos,
} from "@/components/home/HomeCommerceRails";
import "./home/home.css";
import "./home/WeeklyDealsHomeFix.css";
import "./home/HomeFeatureRails.css";
import "./home/HomeCommerceRails.css";
import HeroFlashBanner from "@/components/HeroFlashBanner";
import CategorySwiper from "@/components/CategorySwiper";
import NewArrivalsRail from "@/components/NewArrivalsRail";
import YouTubeGuide from "@/components/YouTubeGuide";
import HomeGuideVideo from "@/components/home/HomeGuideVideo";
import SkillsShowcase, {
  type PageSettings as PrimeSkillsPageSettings,
  type SkillItem,
} from "@/components/SkillsShowcase";
import PrimeFamilyDashboard from "@/components/reseller/PrimeFamilyDashboard";
import Footer from "@/components/Footer";
import {
  cacheCatalogForNavigation,
  cacheProductForNavigation,
} from "@/lib/productNavigationCache";
import { SettingsProvider } from "@/lib/useSettings";
import type {
  Category,
  Product as SharedProduct,
  SiteSettings,
  Weekday,
} from "@/lib/types";
import type { Product } from "@/components/shop/ShopTypes";
import { CATALOG_REFRESH_EVENT } from "@/lib/catalogRefreshSignal";
import { fetchPublicStorefront, invalidatePublicStorefront } from "@/lib/storefrontClient";

type Props = {
  initialProducts: Product[];
  initialCategories: Category[];
  initialSettings: Partial<SiteSettings>;
  initialWeekday: Weekday;
  initialSkills: SkillItem[];
  initialSkillsPage: Partial<PrimeSkillsPageSettings> | null;
};

const RECOVERY_DELAYS_MS = [0];
const BACKGROUND_REFRESH_INTERVAL_MS = 5 * 60_000;

export default function HomePageClient({
  initialProducts,
  initialCategories,
  initialSettings,
  initialWeekday,
  initialSkills,
  initialSkillsPage,
}: Props) {
  const router = useRouter();
  const [selectedMaxPrice, setSelectedMaxPrice] = useState<number | null>(null);
  const [wholesaleSelected, setWholesaleSelected] = useState(false);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [recoveringCatalog, setRecoveringCatalog] = useState(
    initialProducts.length === 0,
  );
  const catalogUnavailable = products.length === 0;
  const lastCatalogRefreshRef = useRef(initialProducts.length > 0 ? Date.now() : 0);

  useEffect(() => {
    // Always open every horizontal homepage rail at its real first item.
    // Some mobile browsers restore nested scroll positions after hydration,
    // and several lower rails mount a little later. Re-assert the left edge
    // briefly, but stop immediately once the shopper touches/swipes.
    const selector =
      ".home-content .home-week-grid, .home-content .home-sale-home-frame .home-sale-products, " +
      ".home-content .home-commerce-rail, .home-content .home-two-row-rail, " +
      ".home-content .ph-live-scroll, .home-content .ph-live-tabs, " +
      ".home-content .snap-x";
    let interacted = false;
    const markInteracted = () => { interacted = true; };
    const reset = () => {
      if (interacted) return;
      document.querySelectorAll<HTMLElement>(selector).forEach((rail) => {
        if (rail.scrollLeft !== 0) rail.scrollLeft = 0;
      });
    };

    window.addEventListener("pointerdown", markInteracted, { passive: true });
    window.addEventListener("touchstart", markInteracted, { passive: true });
    window.addEventListener("wheel", markInteracted, { passive: true });

    const timers = [0, 80, 220, 500, 900].map((delay) =>
      window.setTimeout(reset, delay),
    );
    const frame = window.requestAnimationFrame(reset);
    const root = document.querySelector(".home-content");
    const observer = root ? new MutationObserver(reset) : null;
    observer?.observe(root as Node, { childList: true, subtree: true });
    const stopObserver = window.setTimeout(() => observer?.disconnect(), 1200);

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.clearTimeout(stopObserver);
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("pointerdown", markInteracted);
      window.removeEventListener("touchstart", markInteracted);
      window.removeEventListener("wheel", markInteracted);
    };
  }, []);

  useEffect(() => {
    setProducts(initialProducts);
    setCategories(initialCategories);
    setRecoveringCatalog(initialProducts.length === 0);

    let cancelled = false;
    async function refreshCatalog(force = false) {
      if (!force && Date.now() - lastCatalogRefreshRef.current < BACKGROUND_REFRESH_INTERVAL_MS) return;
      try {
        for (const delay of RECOVERY_DELAYS_MS) {
          if (delay > 0)
            await new Promise((resolve) => window.setTimeout(resolve, delay));
          if (cancelled) return;

          try {
            const response = await fetchPublicStorefront('catalog');
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
              lastCatalogRefreshRef.current = Date.now();
              return;
            }
          } catch (error) {
            console.warn("Homepage catalog refresh attempt failed", error);
          }
        }
      } finally {
        if (!cancelled) setRecoveringCatalog(false);
      }
    }

    // A populated server seed is already fresh within the page revalidation
    // window. Avoid downloading the complete catalog again during hydration;
    // this otherwise competes with above-the-fold images on slow connections.
    if (initialProducts.length === 0) void refreshCatalog(true);

    // Keep an already-open storefront synchronized with Admin/Bot catalog writes.
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshCatalog();
    }, BACKGROUND_REFRESH_INTERVAL_MS);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshCatalog();
    };
    const refreshAfterAdminWrite = () => {
      invalidatePublicStorefront('catalog');
      void refreshCatalog(true);
    };
    const refreshFromStorage = (event: StorageEvent) => {
      if (event.key === CATALOG_REFRESH_EVENT) refreshAfterAdminWrite();
    };
    const catalogChannel = typeof BroadcastChannel !== "undefined"
      ? new BroadcastChannel(CATALOG_REFRESH_EVENT)
      : null;
    if (catalogChannel) catalogChannel.onmessage = refreshAfterAdminWrite;
    window.addEventListener("focus", refreshWhenVisible);
    window.addEventListener(CATALOG_REFRESH_EVENT, refreshAfterAdminWrite);
    window.addEventListener("storage", refreshFromStorage);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
      window.removeEventListener("focus", refreshWhenVisible);
      window.removeEventListener(CATALOG_REFRESH_EVENT, refreshAfterAdminWrite);
      window.removeEventListener("storage", refreshFromStorage);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      catalogChannel?.close();
    };
  }, [initialProducts, initialCategories]);

  useEffect(() => {
    cacheCatalogForNavigation(products, categories);
  }, [products, categories]);

  const handleStorefrontClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as Element | null;
    const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
    if (!anchor) return;

    const url = new URL(anchor.href, window.location.origin);
    if (url.origin !== window.location.origin || !url.pathname.startsWith("/product/")) return;

    const encodedProductId = url.pathname.slice("/product/".length).split("/")[0] || "";
    const productId = decodeURIComponent(encodedProductId);
    const selectedProduct = products.find((product) => product.id === productId);
    if (selectedProduct) cacheProductForNavigation(selectedProduct);

    if (anchor.closest(".home-big-deal")) {
      url.searchParams.set("deal", "big");
    }

    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    event.preventDefault();
    router.push(`${url.pathname}${url.search}${url.hash}`);
  };

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
      <div className="home-storefront" onClickCapture={handleStorefrontClickCapture}>
        <Header categories={categories} />
        <main className="home-content">
          <h1 className="sr-only">
            PrimeHubMall — Bangles, Jewellery &amp; Wholesale Deals
          </h1>
          <HomeGuideVideo mode="intro" />
          <CategorySwiper initialCategories={categories} liveUpdates={false} />
          <HeroFlashBanner
            homeLayout
            initialProducts={products as SharedProduct[]}
            liveUpdates={false}
            initialWeekday={initialWeekday}
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
          <HomeWholesaleVideos />
          <HomePrimeSkills />
          <HomeCategoryDeals products={products} categories={categories} />
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
              <HomeCollections
                products={products}
                standalone
                embeddedHome
              />
            )}
          </div>
          <SkillsShowcase
            embedded
            initialItems={initialSkills}
            initialPage={initialSkillsPage}
          />
          <PrimeFamilyDashboard embedded />
        </main>
        <YouTubeGuide />
        <Footer onWholesaleSelect={selectWholesale} />
      </div>
    </SettingsProvider>
  );
}
