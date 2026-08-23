import { Suspense } from 'react';
import ShopCatalog from '@/components/ShopCatalog';
import { slugifyCategory } from '@/lib/categoryUtils';

export default async function CategoryPage({
  params,
}: {
  params: { slug: string } | Promise<{ slug: string }>;
}) {
  const resolved = await Promise.resolve(params);
  const slug = slugifyCategory(decodeURIComponent(resolved.slug || '')) || decodeURIComponent(resolved.slug || '');

  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F4F4F1] p-8 text-center text-xs text-black/50">Loading category...</div>}>
      <ShopCatalog initialCategory={slug} />
    </Suspense>
  );
}
