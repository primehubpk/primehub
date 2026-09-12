import Link from 'next/link';
import { categoryHref } from '@/lib/categoryUtils';
import { normalizeImageUrl } from '@/lib/imageUrl';
import type { Category } from './ShopTypes';

export default function CompactCategoryStrip({ categories }: { categories: Category[] }) {
  const active = categories.filter((category) => category.active !== false);
  return (
    <section className="mt-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-black">Shop by category</h2>
        <Link href="/category" prefetch className="text-[8px] font-black uppercase tracking-wider text-[#0F6A5F]">
          {active.length} categories
        </Link>
      </div>
      <div className="grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-6 md:grid-cols-8">
        {active.map((category, index) => {
          const image = normalizeImageUrl(category.imageUrl || category.iconUrl || '');
          const eager = index < 8;
          return (
            <Link key={category.id} href={categoryHref(category)} prefetch className="min-w-0 text-center">
              <span className="mx-auto flex aspect-square w-full max-w-[64px] overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
                {image ? (
                  <img
                    src={image}
                    alt={category.title}
                    loading={eager ? 'eager' : 'lazy'}
                    fetchPriority={eager ? 'high' : 'auto'}
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="m-auto text-lg">✨</span>
                )}
              </span>
              <span className="mt-1.5 block truncate text-[9px] font-black">{category.title}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
