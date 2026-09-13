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
  title = 'Explore more categories',
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
    <section className="mt-7 rounded-[24px] border border-[#E8E2D8] bg-[linear-gradient(105deg,#F2F8F1_0%,#FFF9F1_52%,#FFF1EE_100%)] px-3 py-3 shadow-[0_8px_24px_rgba(63,47,27,0.05)] sm:px-4">
      <div className="flex items-center gap-3">
        <div className="w-[112px] shrink-0 border-r border-[#D9C9B5] pr-3 sm:w-[145px]">
          <h2 className="text-[15px] font-black leading-[1.08] tracking-[-0.025em] text-[#211B14] sm:text-[18px]">
            {title}
          </h2>
        </div>

        <div className="flex min-w-0 flex-1 snap-x gap-3 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {visible.map((cat) => {
            const label = cat.name || cat.title || cat.id || 'Category';
            const icon = cat.iconUrl || cat.imageUrl || cat.image;

            return (
              <Link
                key={cat.id}
                href={categoryHref(cat)}
                prefetch={false}
                className="flex w-[58px] shrink-0 snap-start flex-col items-center gap-1.5 text-center sm:w-[64px]"
                aria-label={`Open ${label} category`}
              >
                <span className="flex h-[48px] w-[48px] items-center justify-center overflow-hidden rounded-full border border-white bg-white p-1 shadow-[0_5px_15px_rgba(20,20,15,0.08)] ring-1 ring-black/5 transition active:scale-95 sm:h-[52px] sm:w-[52px]">
                  {icon ? (
                    <img src={icon} alt="" className="h-full w-full rounded-full object-cover" />
                  ) : (
                    <span className="text-base font-black text-[#9A681B]">{label.charAt(0)}</span>
                  )}
                </span>
                <span className="line-clamp-2 text-[8px] font-bold leading-[10px] text-black/65 sm:text-[9px] sm:leading-3">
                  {label}
                </span>
              </Link>
            );
          })}
        </div>

        <Link
          href="/shop"
          prefetch={false}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#4A3B28] shadow-sm ring-1 ring-black/5 transition active:scale-95"
          aria-label="View all categories"
        >
          <ChevronRight size={17} />
        </Link>
      </div>
    </section>
  );
}
