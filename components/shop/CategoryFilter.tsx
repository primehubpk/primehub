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
  title = 'Explore all categories',
}: Props) {
  const visible = categories.filter((cat) => cat.active !== false);

  return (
    <section className="mt-7 rounded-[24px] border border-[#E9E1D5] bg-[linear-gradient(105deg,#F6FAF4_0%,#FFF8EF_52%,#FFF1EE_100%)] px-3.5 py-3.5 shadow-[0_8px_24px_rgba(63,47,27,0.05)] sm:px-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[8px] font-black uppercase tracking-[0.2em] text-[#A66B17]">Keep exploring</p>
          <h2 className="mt-0.5 text-base font-black tracking-tight text-[#211B14]">{title}</h2>
        </div>
        <Link
          href="/shop"
          prefetch={false}
          className="flex shrink-0 items-center gap-0.5 rounded-full bg-white/85 px-2.5 py-1.5 text-[9px] font-black text-[#74501B] shadow-sm ring-1 ring-black/5"
        >
          View all <ChevronRight size={13} />
        </Link>
      </div>

      <div className="flex snap-x gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {visible.map((cat) => {
          const label = cat.name || cat.title || cat.id || 'Category';
          const icon = cat.iconUrl || cat.imageUrl || cat.image;
          const selected = category !== 'all' && productMatchesCategory(
            category,
            { category: cat.title || cat.name, categoryId: cat.id },
            [cat],
          );

          return (
            <Link
              key={cat.id}
              href={categoryHref(cat)}
              prefetch={false}
              className="flex w-[70px] shrink-0 snap-start flex-col items-center gap-1.5 text-center"
              aria-current={selected ? 'page' : undefined}
            >
              <span className={`flex h-[58px] w-[58px] items-center justify-center overflow-hidden rounded-full border bg-white p-1 shadow-[0_6px_18px_rgba(20,20,15,0.07)] transition active:scale-95 ${selected ? 'border-[#B7791F] ring-2 ring-[#B7791F]/15' : 'border-white'}`}>
                {icon ? (
                  <img src={icon} alt="" className="h-full w-full rounded-full object-cover" />
                ) : (
                  <span className="text-lg font-black text-[#9A681B]">{label.charAt(0)}</span>
                )}
              </span>
              <span className={`line-clamp-2 text-[9px] font-bold leading-3 ${selected ? 'text-[#9A681B]' : 'text-black/65'}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
