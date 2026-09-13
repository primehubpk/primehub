import Link from 'next/link';
import { Grid2X2 } from 'lucide-react';
import { categoryHref } from '@/lib/categoryUtils';
import { normalizeImageUrl } from '@/lib/imageUrl';
import type { Category } from './ShopTypes';

export default function CompactCategoryStrip({ categories }: { categories: Category[] }) {
  const active = [...categories]
    .filter((category) => category.active !== false)
    .sort((a, b) => Number(a.sortOrder ?? 999) - Number(b.sortOrder ?? 999));

  return (
    <section className="mt-4" aria-label="Shop by category">
      <div className="flex gap-2.5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-3">
        {active.map((category, index) => {
          const image = normalizeImageUrl(category.imageUrl || category.iconUrl || category.image || '');
          const eager = index < 8;
          const label = category.title || category.name || 'Category';
          return (
            <Link
              key={category.id}
              href={categoryHref(category)}
              prefetch
              className="group w-[78px] shrink-0 text-center sm:w-[96px] lg:w-[108px]"
              aria-label={`Open ${label}`}
            >
              <span className="mx-auto flex h-[62px] w-[62px] overflow-hidden rounded-[18px] border border-[#E9E1D6] bg-white shadow-[0_7px_20px_rgba(50,40,28,0.06)] transition group-hover:-translate-y-0.5 group-hover:border-[#D9C4A5] sm:h-[76px] sm:w-[76px] sm:rounded-[20px] lg:h-[82px] lg:w-[82px]">
                {image ? (
                  <img
                    src={image}
                    alt=""
                    loading={eager ? 'eager' : 'lazy'}
                    fetchPriority={eager ? 'high' : 'auto'}
                    decoding="async"
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
                  />
                ) : (
                  <span className="m-auto text-xl">✨</span>
                )}
              </span>
              <span className="mt-1.5 block line-clamp-2 text-[9px] font-extrabold leading-3 text-[#29241E] sm:text-[10px] sm:leading-[13px]">
                {label}
              </span>
            </Link>
          );
        })}

        <Link href="/category" prefetch className="group w-[78px] shrink-0 text-center sm:w-[96px] lg:w-[108px]" aria-label="Open all categories">
          <span className="mx-auto flex h-[62px] w-[62px] items-center justify-center rounded-[18px] border border-[#D9E7E2] bg-[#EFF7F4] text-[#0F6A5F] shadow-[0_7px_20px_rgba(50,40,28,0.05)] transition group-hover:-translate-y-0.5 sm:h-[76px] sm:w-[76px] sm:rounded-[20px] lg:h-[82px] lg:w-[82px]">
            <Grid2X2 size={22} />
          </span>
          <span className="mt-1.5 block text-[9px] font-extrabold leading-3 text-[#29241E] sm:text-[10px]">All Categories</span>
        </Link>
      </div>
    </section>
  );
}
