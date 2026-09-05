import type { Metadata } from 'next';
import { Suspense } from 'react';
import ShopCatalog from '@/components/ShopCatalog';
import { slugifyCategory } from '@/lib/categoryUtils';
import { getPublicCatalogSnapshot } from '@/lib/publicCatalogServer';

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

export default async function CategoryPage({
  params,
}: {
  params: { slug: string } | Promise<{ slug: string }>;
}) {
  const resolved = await Promise.resolve(params);
  const slug = slugifyCategory(decodeURIComponent(resolved.slug || '')) || decodeURIComponent(resolved.slug || '');
  const snapshot = await getPublicCatalogSnapshot();

  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F4F4F1] p-8 text-center text-xs text-black/50">Loading category...</div>}>
      <ShopCatalog initialCategory={slug} initialProducts={snapshot.products} initialCategories={snapshot.categories} />
    </Suspense>
  );
}
