import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/home/HomeHeader';
import GlassOffersLanding from '@/components/home/GlassOffersLanding';
import { resolveGlassOffers, isExclusiveGlassDealProduct } from '@/lib/glassOffers';
import { compactPublicCatalogSnapshot, getPublicCatalogSnapshot, getStorefrontSettingsSnapshot } from '@/lib/publicCatalogServer';
import type { Product, Category } from '@/lib/types';
import '@/components/home/home.css';

export const revalidate = 600;
export const metadata: Metadata = {
  title: 'Glass Bangles Special Deals | PrimeHubMall',
  description: 'Explore the exclusive glass bangle deal boxes. See actual prices and savings before ordering.',
};

export default async function GlassBanglesDealsPage() {
  const [catalogResult, settingsResult] = await Promise.allSettled([
    getPublicCatalogSnapshot(), getStorefrontSettingsSnapshot(),
  ]);
  const catalog = catalogResult.status === 'fulfilled'
    ? compactPublicCatalogSnapshot(catalogResult.value) : { products: [], categories: [] };
  const settings = settingsResult.status === 'fulfilled' ? settingsResult.value : {};
  const config = resolveGlassOffers(settings.glassDealShowcase);
  const exclusive = { ...config, items: config.items.filter(item => isExclusiveGlassDealProduct(item.productId)) };
  return <><Header categories={catalog.categories as Category[]}/>
    <main className="glass-offers-landing mx-auto min-h-screen max-w-6xl px-3 pt-4 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-2 text-xs text-black/50">
        <Link href="/">Home</Link><span>/</span><Link href="/deals">Mega Deals</Link><span>/</span><span>Glass Bangles Deals</span>
      </nav>
      <GlassOffersLanding products={catalog.products as Product[]} categories={catalog.categories as Category[]}
        config={exclusive} activePath="/deals/glass-bangles" headingOverride="Glass Bangles Deal Collection" />
    </main></>;
}
