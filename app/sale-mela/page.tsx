import type { Metadata } from 'next';
import Link from 'next/link';
import HomeCollections from '@/components/home/HomeCollections';
import ProductNavigationSeed from '@/components/ProductNavigationSeed';
import { SettingsProvider } from '@/lib/useSettings';
import { getPublicCatalogSnapshot, getStorefrontSettingsSnapshot } from '@/lib/publicCatalogServer';
import type { SiteSettings } from '@/lib/types';
import type { Product } from '@/components/shop/ShopTypes';
import '@/components/home/home.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'PrimeHubMall Sale Mela',
  description: 'Browse PrimeHubMall Sale Mela price collections and wholesale deals.',
  alternates: { canonical: '/sale-mela' },
};

export default async function SaleMelaPage() {
  const [catalogResult, settingsResult] = await Promise.allSettled([
    getPublicCatalogSnapshot(),
    getStorefrontSettingsSnapshot(),
  ]);

  const catalog = catalogResult.status === 'fulfilled'
    ? catalogResult.value
    : { products: [], categories: [] };
  const initialSettings = settingsResult.status === 'fulfilled'
    ? settingsResult.value
    : {};

  return (
    <SettingsProvider initialSettings={initialSettings as Partial<SiteSettings>}>
      <div className="home-storefront min-h-screen">
        <ProductNavigationSeed products={catalog.products} />
        <main className="home-content pb-20 pt-4">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/"
              prefetch={true}
              className="inline-flex items-center rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-black shadow-sm"
            >
              ← Home
            </Link>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-black/40">
              Swipe every collection
            </p>
          </div>

          <HomeCollections products={catalog.products as Product[]} />
        </main>
      </div>
    </SettingsProvider>
  );
}
