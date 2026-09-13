import type { Metadata } from 'next';
import { Suspense } from 'react';
import ShopCatalog from '@/components/ShopCatalog';
import { slugifyCategory } from '@/lib/categoryUtils';
import { SettingsProvider } from '@/lib/useSettings';
import { getPublicCatalogSnapshot, getStorefrontSettingsSnapshot } from '@/lib/publicCatalogServer';
import type { SiteSettings } from '@/lib/types';
import type { Product, Category } from '@/components/shop/ShopTypes';

export const revalidate = 300;

function humanizeCategory(value: string) {
  return decodeURIComponent(value || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string } | Promise<{ slug: string }>;
}): Promise<Metadata> {
  const resolved = await Promise.resolve(params);
  const rawSlug = decodeURIComponent(resolved.slug || '');
  const slug = slugifyCategory(rawSlug) || rawSlug;
  const category = humanizeCategory(slug);
  const title = category ? `${category} Online in Pakistan` : 'Shop Categories';
  const description = category
    ? `Shop ${category} at PrimeHubMall Pakistan. Explore retail prices, wholesale deals, new arrivals and nationwide delivery.`
    : 'Explore PrimeHubMall categories, retail products and wholesale deals in Pakistan.';

  return {
    title,
    description,
    alternates: { canonical: `/category/${encodeURIComponent(slug)}` },
    openGraph: {
      title: `${title} | PrimeHubMall`,
      description,
      url: `/category/${encodeURIComponent(slug)}`,
    },
  };
}

function CategoryLoadingState() {
  return (
    <main className="min-h-screen bg-[#F4F4F1] px-4 pb-28 pt-5" role="status" aria-label="Opening category">
      <div className="mx-auto max-w-6xl animate-pulse">
        <div className="h-12 rounded-2xl bg-white shadow-sm" />
        <div className="mt-4 flex gap-2 overflow-hidden">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="h-9 w-24 shrink-0 rounded-full bg-white shadow-sm" />
          ))}
        </div>
        <div className="mt-6 h-6 w-48 rounded-full bg-black/[0.08]" />
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="rounded-2xl bg-white p-3 shadow-sm">
              <div className="aspect-square rounded-xl bg-black/[0.06]" />
              <div className="mt-3 h-3 w-4/5 rounded-full bg-black/[0.08]" />
              <div className="mt-2 h-3 w-1/2 rounded-full bg-black/[0.05]" />
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Loading category products…</span>
    </main>
  );
}

async function SeededCategoryCatalog({ slug }: { slug: string }) {
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
      <ShopCatalog
        initialCategory={slug}
        initialProducts={catalog.products as Product[]}
        initialCategories={catalog.categories as Category[]}
      />
    </SettingsProvider>
  );
}

export default async function CategoryPage({
  params,
}: {
  params: { slug: string } | Promise<{ slug: string }>;
}) {
  const resolved = await Promise.resolve(params);
  const rawSlug = decodeURIComponent(resolved.slug || '');
  const slug = slugifyCategory(rawSlug) || rawSlug;

  return (
    <Suspense fallback={<CategoryLoadingState />}>
      <SeededCategoryCatalog slug={slug} />
    </Suspense>
  );
}
