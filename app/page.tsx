import { Suspense } from 'react';
import HomePageClient from '@/components/HomePageClient';
import { getPublicCatalogSnapshot, getStorefrontSettingsResultSnapshot } from '@/lib/publicCatalogServer';
import type { Category, SiteSettings } from '@/lib/types';
import type { Product } from '@/components/shop/ShopTypes';

export const revalidate = 60;

function productImage(product: any) {
  if (!product) return '';
  if (typeof product.imageUrl === 'string' && product.imageUrl.trim()) return product.imageUrl.trim();
  if (typeof product.image === 'string' && product.image.trim()) return product.image.trim();
  const first = Array.isArray(product.images) ? product.images[0] : null;
  if (typeof first === 'string') return first.trim();
  if (first && typeof first.url === 'string') return first.url.trim();
  return '';
}

function hydrateBigDealImages(settings: Record<string, any>, products: any[]) {
  const dailyDeal = settings?.dailyDeal;
  if (!dailyDeal || typeof dailyDeal !== 'object') return settings;

  const productById = new Map(products.map((product) => [String(product?.id || ''), product]));
  const productIds = Array.isArray(dailyDeal.productIds) ? dailyDeal.productIds : [];
  const savedImages = Array.isArray(dailyDeal.imageUrls) ? dailyDeal.imageUrls : [];
  const slotCount = Math.max(productIds.length, savedImages.length, 7);
  const imageUrls = Array.from({ length: slotCount }, (_, index) => {
    const saved = String(savedImages[index] || '').trim();
    if (saved) return saved;
    const productId = String(productIds[index] || (index === 0 ? dailyDeal.productId || '' : '')).trim();
    return productImage(productById.get(productId));
  });

  const firstProductId = String(dailyDeal.productId || productIds[0] || '').trim();
  const firstImage = String(dailyDeal.imageUrl || '').trim() || imageUrls[0] || productImage(productById.get(firstProductId));

  return {
    ...settings,
    dailyDeal: {
      ...dailyDeal,
      imageUrl: firstImage,
      imageUrls,
    },
  };
}

function HomeLoadingState() {
  return (
    <main className="min-h-screen bg-[#FFFCF7] px-4 pb-28 pt-5" role="status" aria-label="Opening home page">
      <div className="mx-auto max-w-6xl animate-pulse">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="h-8 w-52 rounded-full bg-black/[0.09]" />
          <div className="mt-4 h-12 rounded-full bg-black/[0.05]" />
        </div>
        <div className="mt-6 grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="text-center">
              <div className="mx-auto aspect-square w-full max-w-[110px] rounded-full bg-black/[0.06]" />
              <div className="mx-auto mt-2 h-3 w-4/5 rounded-full bg-black/[0.07]" />
            </div>
          ))}
        </div>
        <div className="mt-7 h-7 w-64 rounded-full bg-black/[0.08]" />
        <div className="mt-4 grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="rounded-2xl bg-white p-3 shadow-sm">
              <div className="aspect-[4/5] rounded-xl bg-black/[0.06]" />
              <div className="mt-3 h-3 w-3/4 rounded-full bg-black/[0.08]" />
              <div className="mt-2 h-3 w-1/2 rounded-full bg-black/[0.05]" />
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Loading PrimeHubMall home…</span>
    </main>
  );
}

async function HomeContent() {
  const [catalogResult, settingsResult] = await Promise.allSettled([
    getPublicCatalogSnapshot(),
    getStorefrontSettingsResultSnapshot(),
  ]);

  const snapshot = catalogResult.status === 'fulfilled'
    ? catalogResult.value
    : { products: [], categories: [] };
  const settingsDocuments = settingsResult.status === 'fulfilled'
    ? (settingsResult.value.documents as Record<string, any>)
    : {};
  const rawSettings = {
    ...(settingsDocuments.general || {}),
    ...(settingsDocuments.main || {}),
  };
  const rewardSettings = settingsDocuments.rewards || {};
  const initialSettings = {
    ...hydrateBigDealImages(rawSettings, snapshot.products as any[]),
    homeRewardSettings: rewardSettings,
  };

  return (
    <HomePageClient
      initialProducts={snapshot.products as Product[]}
      initialCategories={snapshot.categories as Category[]}
      initialSettings={initialSettings as Partial<SiteSettings>}
    />
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomeLoadingState />}>
      <HomeContent />
    </Suspense>
  );
}
