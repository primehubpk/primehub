'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { categoryHref, productMatchesCategory } from '@/lib/categoryUtils';
import { normalizeImageUrl } from '@/lib/imageUrl';
import { HomeProductCard } from '@/components/home/HomeCollections';
import type { Product } from '@/components/shop/ShopTypes';
import type { Category } from '@/lib/types';
import { orderHomeProducts, railSeed } from '@/lib/homeRailOrder';

export default function HomeCategoryDeals({ products, categories }: { products: Product[]; categories: Category[] }) {
  const [refreshSeed, setRefreshSeed] = useState(0);

  useEffect(() => {
    // Keep the server/first browser render stable, then rotate category cards
    // once per page load. orderHomeProducts gives newer items a stronger
    // freshness weight while still mixing older stock into the rail.
    setRefreshSeed(railSeed());
  }, []);

  const visible = [...categories]
    .filter((category) => category.active !== false && String(category.title || '').trim())
    .sort((a, b) => Number(a.sortOrder ?? 999) - Number(b.sortOrder ?? 999) || a.title.localeCompare(b.title));

  return (
    <section className="mt-2 space-y-5" aria-label="Shop products by category">
      {visible.map((category) => {
        const matches = orderHomeProducts(
          products.filter((product) => product.published !== false &&
            productMatchesCategory(category.title, product, categories)),
          refreshSeed,
        );
        if (!matches.length) return null;
        const image = normalizeImageUrl(category.iconUrl || category.imageUrl || '');
        return <div key={category.id} className="rounded-[24px] border border-[#DCCCA8]/60 bg-[#FFFCF7] py-4 shadow-sm">
          <Link href={categoryHref(category)} prefetch={false} className="group mx-4 mb-3 flex w-fit items-center gap-3">
            <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border-[3px] border-[#F4C64A] bg-[#F4F4F1] shadow-md">
              {image ? <Image src={image} alt="" fill unoptimized sizes="56px" className="object-cover" /> :
                <span className="flex h-full items-center justify-center font-black text-[#0F6A5F]">{category.title.charAt(0)}</span>}
            </span>
            <span><span className="block text-[9px] font-black uppercase tracking-widest text-[#A26D13]">Browse category</span>
              <span className="block text-base font-black text-[#14140F] group-hover:text-[#0F6A5F]">{category.title} →</span></span>
          </Link>
          <div
            className="snap-x snap-mandatory overflow-x-auto overscroll-x-contain px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{
              display: 'grid',
              gridTemplateColumns: 'none',
              gridAutoFlow: 'column',
              gridTemplateRows: 'repeat(2, auto)',
              gridAutoColumns: 'calc((100% - 10px) / 2)',
              gap: '8px 10px',
            }}
          >
            {matches.map((product) => (
              <div key={product.id} className="min-w-0 snap-start">
                <HomeProductCard product={product} />
              </div>
            ))}
          </div>
        </div>;
      })}
    </section>
  );
}
