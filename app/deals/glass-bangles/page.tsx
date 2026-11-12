import type { Metadata } from 'next';
import Link from 'next/link';
import { compactPublicCatalogSnapshot, getPublicCatalogSnapshot, getStorefrontSettingsResultSnapshot } from '@/lib/publicCatalogServer';
import GlassOffersLanding from '@/components/home/GlassOffersLanding';
import type { Product } from '@/lib/types';
import type { GlassOfferSettings } from '@/lib/glassOffers';

export const revalidate = 600;
export const metadata: Metadata = {
  title: 'Glass Bangles & Special Offers | PrimeHubMall',
  description: 'Browse colourful glass bangles boxes and special deals. Real prices, original product photos and size or colour selections.',
};

export default async function GlassBanglesOffersPage() {
  const [catalog, settings] = await Promise.allSettled([
    getPublicCatalogSnapshot(),
    getStorefrontSettingsResultSnapshot(),
  ]);
  const products = catalog.status === 'fulfilled'
    ? compactPublicCatalogSnapshot(catalog.value).products as Product[]
    : [];
  const documents = settings.status === 'fulfilled'
    ? settings.value.documents as Record<string, any>
    : {};
  const config = (documents.main?.glassDealShowcase ?? documents.general?.glassDealShowcase) as Partial<GlassOfferSettings> | undefined;
  return (
    <main className="glass-offers-landing mx-auto min-h-screen max-w-7xl px-4 pt-6 sm:px-6">
      <nav className="mb-4 flex items-center gap-2 text-xs font-semibold text-black/55">
        <Link href="/" className="hover:text-[#0f6a5f]">Home</Link>
        <span>/</span><span>Special Offers</span><span>/</span><span className="text-[#b9231c]">Glass Bangles</span>
      </nav>
      <GlassOffersLanding products={products} config={config} />
    </main>
  );
}
