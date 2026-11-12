import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/home/HomeHeader';
import '@/components/home/home.css';
import GlassOffersLanding from '@/components/home/GlassOffersLanding';
import { compactPublicCatalogSnapshot, getPublicCatalogSnapshot, getStorefrontSettingsSnapshot } from '@/lib/publicCatalogServer';
import type { Product, Category } from '@/lib/types';

export const revalidate = 600;
export const metadata: Metadata = { title: 'Mega Deals | PrimeHubMall', description: 'Shop all PrimeHubMall special offers in one place. Bangles, watches, bags and more, ready to order every day.' };

export default async function DealsPage() {
  const [catalogResult, settingsResult] = await Promise.allSettled([getPublicCatalogSnapshot(), getStorefrontSettingsSnapshot()]);
  const catalog = catalogResult.status === 'fulfilled' ? compactPublicCatalogSnapshot(catalogResult.value) : { products: [], categories: [] };
  const settings = settingsResult.status === 'fulfilled' ? settingsResult.value : {};
  return <><Header categories={catalog.categories as Category[]} /><main className="glass-offers-landing mx-auto min-h-screen max-w-6xl px-3 pt-4 sm:px-6">
    <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-2 text-xs text-black/50"><Link href="/">Home</Link><span>/</span><span>Mega Deals</span></nav>
    <GlassOffersLanding products={catalog.products as Product[]} categories={catalog.categories as Category[]} config={settings.glassDealShowcase} />
  </main></>;
}
