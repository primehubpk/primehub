'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { categoryHref, productMatchesCategory } from '@/lib/categoryUtils';
import { Category } from './ShopTypes';

type Props = {
  categories: Category[];
  category: string;
  title?: string;
};

export default function CategoryFilter({
  categories,
  category,
  title = 'Shop by Category',
}: Props) {
  const visible = categories.filter((cat) => {
    if (cat.active === false) return false;
    if (category === 'all') return true;

    return !productMatchesCategory(
      category,
      { category: cat.title || cat.name, categoryId: cat.id },
      [cat],
    );
  });

  if (!visible.length) return null;

  return (
    <section className="mt-8 border-t border-[#E7DED1]/80 pt-6" aria-label="More categories">
      <div className="mb-3 flex items-end justify-between px-0.5">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#0F6A5F]">
            Browse the collection
          </p>
          <h2 className="mt-0.5 text-base font-black tracking-tight text-[#14140F] sm:text-lg">
            {title}
          </h2>
        </div>
        <Link
          href="/category"
          prefetch
          className="flex items-center gap-0.5 rounded-full bg-white px-2.5 py-1.5 text-[10px] font-black text-[#0F6A5F] shadow-sm ring-1 ring-black/5 transition active:scale-95"
        >
          View all <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-visible overscroll-x-contain scroll-smooth pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {visible.map((cat) => {
          const label = cat.name || cat.title || cat.id || 'Category';
          const icon = cat.iconUrl || cat.imageUrl || cat.image;

          return (
            <Link
              key={cat.id}
              href={categoryHref(cat)}
              prefetch
              className="group w-[92px] shrink-0 snap-start text-center"
              aria-label={`Open ${label} category`}
            >
              <span className="relative mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-[#F4F4F1] ring-1 ring-black/5 transition group-active:scale-95">
                {icon ? (
                  <img src={icon} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xl font-black text-[#0F6A5F]">{label.charAt(0)}</span>
                )}
              </span>
              <span className="mt-2 block truncate text-center text-[10px] font-black text-[#14140F]">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
