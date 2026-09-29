import { Suspense } from 'react';
import BigDealLanding from '@/components/deals/BigDealLanding';
import ShopLandingCatalog from '@/components/shop/ShopLandingCatalog';
import { SettingsProvider } from '@/lib/useSettings';
import { compactPublicCatalogSnapshot, getPublicCatalogSnapshot, getStorefrontSettingsSnapshot } from '@/lib/publicCatalogServer';
import type { SiteSettings } from '@/lib/types';
import type { Product, Category } from '@/components/shop/ShopTypes';

export const revalidate = 600;

export default async function BigDealPage() {
  const [catalogResult, settingsResult] = await Promise.allSettled([
    getPublicCatalogSnapshot(), getStorefrontSettingsSnapshot(),
  ]);
  const catalog = catalogResult.status === 'fulfilled'
    ? compactPublicCatalogSnapshot(catalogResult.value)
    : { products: [], categories: [] };
  const settings = settingsResult.status === 'fulfilled' ? settingsResult.value : {};

  return <SettingsProvider initialSettings={settings as Partial<SiteSettings>}>
    <BigDealLanding deal={(settings as SiteSettings).dailyDeal} products={catalog.products as Product[]} />
    <div className="mx-auto max-w-6xl border-t border-[#DCCCA8]/60 pt-8">
      <div className="px-4"><p className="text-[10px] font-black uppercase tracking-widest text-[#A26D13]">Keep exploring</p><h2 className="mt-1 text-2xl font-black">Shop all products</h2></div>
      <Suspense fallback={null}>
        <ShopLandingCatalog initialProducts={catalog.products as Product[]} initialCategories={catalog.categories as Category[]} />
      </Suspense>
    </div>
  </SettingsProvider>;
}
