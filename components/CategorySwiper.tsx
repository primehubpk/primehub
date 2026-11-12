// components/CategorySwiper.tsx
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useContinuousHomeRail } from '@/lib/useContinuousHomeRail';
import { collection, onSnapshot } from 'firebase/firestore';
import { BadgePercent, Grid2X2, Package } from 'lucide-react';
import { db } from '@/lib/firebase';
import { categoryHref } from '@/lib/categoryUtils';
import { normalizeImageUrl } from '@/lib/imageUrl';
import { Category } from '@/lib/types';

const ABOVE_THE_FOLD_CATEGORY_IMAGES = 6;


export default function CategorySwiper({
  initialCategories = [],
  liveUpdates = true,
}: {
  initialCategories?: Category[];
  liveUpdates?: boolean;
}) {
  const router = useRouter();
  const categoryRailRef = useRef<HTMLDivElement>(null);
  const [categories, setCategories] = useState<Category[]>(initialCategories);

  useEffect(() => {
    setCategories(initialCategories);
  }, [initialCategories]);

  useEffect(() => {
    if (!liveUpdates) return;
    const stop = onSnapshot(
      collection(db, 'categories'),
      (snap) => setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Category[]),
    );
    return () => stop();
  }, [liveUpdates]);

  const visible = useMemo(
    () => categories
      .filter((category) => category.active !== false && String(category.title || '').trim())
      .sort((a, b) => Number(a.sortOrder ?? 999) - Number(b.sortOrder ?? 999) || a.title.localeCompare(b.title)),
    [categories],
  );

  useContinuousHomeRail(categoryRailRef, { itemCount: visible.length, speed: 20 });
  if (!visible.length) return null;

  return (
    <section className="home-categories mx-auto mt-7 max-w-6xl px-4">
      <div className="mb-3 grid grid-cols-3 items-center gap-1  sm:gap-2" style={{ display: 'grid' }}>
        <div className="flex justify-center">
          <Link
          href="/primehubmall/salemela"
          prefetch={false}
          onPointerDown={() => router.prefetch('/primehubmall/salemela')}
          onFocus={() => router.prefetch('/primehubmall/salemela')}
          aria-label="Open PrimeHubMall Sale Mela"
          className="group flex flex-col items-center gap-1 text-center"
        >
          <span className="category-entry-icon relative flex h-[60px] w-[60px] items-center justify-center overflow-hidden rounded-full border-[3px] border-[#F4C64A] bg-gradient-to-br from-[#FF5A50] via-[#E1352B] to-[#9F1414] text-white shadow-[0_6px_16px_rgba(225,53,43,0.24)] transition-transform group-hover:scale-105 sm:h-[68px] sm:w-[68px]">
            <span className="absolute inset-[3px] rounded-full border border-white/45" aria-hidden="true" />
            <BadgePercent size={27} strokeWidth={2.4} aria-hidden="true" />
          </span>
          <span className="max-w-full text-[8px] font-black leading-tight text-[#E1352B] sm:text-[9px]">Sale Mela</span>
          </Link>
        </div>

        <div className="flex justify-center">
          <Link href="/category" prefetch={false} onPointerDown={() => router.prefetch('/category')} onFocus={() => router.prefetch('/category')}
            className="group flex flex-col items-center gap-1 text-center" aria-label="Shop by Category">
            <span className="category-entry-icon relative flex h-[60px] w-[60px] items-center justify-center overflow-hidden rounded-full border-[3px] border-[#F4C64A] bg-gradient-to-br from-[#1B9A89] via-[#0F6A5F] to-[#07453D] text-white shadow-[0_6px_16px_rgba(15,106,95,0.24)] sm:h-[68px] sm:w-[68px]">
              <span className="absolute inset-[3px] rounded-full border border-white/45" aria-hidden="true" />
              <Grid2X2 size={27} strokeWidth={2.25} aria-hidden="true" />
            </span>
            <span className="text-[8px] font-black leading-tight text-[#0F6A5F] sm:text-[9px]">Shop by Category</span>
          </Link>
        </div>

        <div className="flex justify-center">
          <Link
          href="/primehubmall/salemela#bucket-wholesale"
          prefetch={false}
          onPointerDown={() => router.prefetch('/primehubmall/salemela')}
          onFocus={() => router.prefetch('/primehubmall/salemela')}
          aria-label="Open PrimeHubMall Wholesale Deals"
          className="group flex flex-col items-center gap-1 text-center"
        >
          <span className="category-entry-icon relative flex h-[60px] w-[60px] items-center justify-center overflow-hidden rounded-full border-[3px] border-[#F4C64A] bg-gradient-to-br from-[#1B9A89] via-[#0F6A5F] to-[#07453D] text-white shadow-[0_6px_16px_rgba(15,106,95,0.24)] transition-transform group-hover:scale-105 sm:h-[68px] sm:w-[68px]">
            <span className="absolute inset-[3px] rounded-full border border-white/45" aria-hidden="true" />
            <Package size={27} strokeWidth={2.25} aria-hidden="true" />
          </span>
          <span className="max-w-full text-[8px] font-black leading-tight text-[#0F6A5F] sm:text-[9px]">Wholesale</span>
          </Link>
        </div>
      </div>

      <div ref={categoryRailRef} className="flex gap-3 overflow-x-auto overflow-y-visible touch-pan-x cursor-grab active:cursor-grabbing overscroll-x-contain pb-3 [scrollbar-width:none] lg:[scrollbar-width:thin] lg:[scrollbar-color:#9ca3af_transparent] [&::-webkit-scrollbar]:hidden lg:[&::-webkit-scrollbar]:block lg:[&::-webkit-scrollbar]:h-1.5 lg:[&::-webkit-scrollbar-thumb]:rounded-full lg:[&::-webkit-scrollbar-thumb]:bg-black/25">
        {(visible.length > 1 ? [0, 1] : [0]).flatMap((copy) => visible.map((category, index) => {
          const aboveTheFold = copy === 0 && index < ABOVE_THE_FOLD_CATEGORY_IMAGES;
          const href = categoryHref(category);
          const image = normalizeImageUrl(category.iconUrl || category.imageUrl || '');
          return (
            <Link
              key={`${copy}:${category.id}`}
              data-loop-original={copy === 0 && index === 0 ? '' : undefined}
              data-loop-copy={copy === 1 && index === 0 ? '' : undefined}
              href={href}
              prefetch={false}
              onPointerDown={() => router.prefetch(href)}
              onFocus={() => router.prefetch(href)}
              className="group w-[92px] shrink-0 text-center lg:w-[78px]"
            >
                <span className="relative mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-[#F4F4F1] ring-1 ring-black/5 lg:h-[68px] lg:w-[68px]">
                  {image ? (
                    <Image
                      src={image}
                      alt={category.title}
                      fill
                      unoptimized
                      priority={aboveTheFold}
                      loading={aboveTheFold ? 'eager' : 'lazy'}
                      fetchPriority={aboveTheFold ? 'high' : 'auto'}
                      sizes="(max-width: 600px) 22vw, 78px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="font-[family-name:var(--font-display)] text-xl font-black text-[#0F6A5F]">{category.title.charAt(0)}</span>
                  )}
                </span>
                <span className="mt-2 block truncate text-center text-[10px] font-black text-[#14140F]">{category.title}</span>
            </Link>
          );
        }))}
      </div>
    </section>
  );
}
