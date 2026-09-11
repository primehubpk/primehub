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

export default async function HomePage() {
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
