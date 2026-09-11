import type { Metadata } from 'next';
import { Suspense } from 'react';
import ShopCatalog from '@/components/ShopCatalog';
import { getPublicCatalogSnapshot } from '@/lib/publicCatalogServer';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Shop Bangles, Jewellery, Watches & Wholesale Deals',
  description:
    'Browse PrimeHubMall products including bangles, jewellery, watches, retail offers and wholesale deals in Pakistan.',
  alternates: { canonical: '/shop' },
  openGraph: {
    title: 'Shop PrimeHubMall Products',
    description: 'Browse retail and wholesale deals from PrimeHubMall Pakistan.',
    url: '/shop',
  },
};

function ShopLoadingState() {
  return (
    <main className="min-h-screen bg-[#F4F4F1] px-4 pb-28 pt-5" role="status" aria-label="Opening shop">
      <div className="mx-auto max-w-6xl animate-pulse">
        <div className="h-12 rounded-2xl bg-white shadow-sm" />
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="rounded-2xl bg-white p-3 shadow-sm">
              <div className="aspect-square rounded-xl bg-black/[0.06]" />
              <div className="mt-3 h-3 w-4/5 rounded-full bg-black/[0.08]" />
              <div className="mt-2 h-3 w-1/2 rounded-full bg-black/[0.05]" />
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Loading shop products…</span>
    </main>
  );
}

async function ShopCatalogContent() {
  try {
    const snapshot = await getPublicCatalogSnapshot();
    return <ShopCatalog initialProducts={snapshot.products} initialCategories={snapshot.categories} />;
  } catch (error) {
    console.error('Shop catalog unavailable', error);
    return (
      <main className="min-h-screen bg-[#F4F4F1] px-4 pb-28 pt-8">
        <div className="mx-auto max-w-md rounded-3xl bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-black text-[#14140F]">Shop is reconnecting</h1>
          <p className="mt-2 text-sm leading-6 text-black/55">Products could not be loaded right now. Please try again.</p>
          <a href="/shop" className="mt-5 inline-flex rounded-full bg-[#14140F] px-5 py-3 text-xs font-black text-white">
            Try again
          </a>
        </div>
      </main>
    );
  }
}

export default function ShopPage() {
  return (
    <Suspense fallback={<ShopLoadingState />}>
      <ShopCatalogContent />
    </Suspense>
  );
}
