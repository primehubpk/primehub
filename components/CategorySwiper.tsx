// components/CategorySwiper.tsx
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { BadgePercent, ChevronRight, Package } from 'lucide-react';
import { db } from '@/lib/firebase';
import { categoryHref } from '@/lib/categoryUtils';
import { normalizeImageUrl } from '@/lib/imageUrl';
import { Category } from '@/lib/types';

const ABOVE_THE_FOLD_CATEGORY_IMAGES = 6;

// These are shortcuts only: both destinations already exist and their category cards
// keep their original links. Keeping them as separate links avoids nested anchors.
const CATEGORY_SHORTCUTS = {
  '/category/jewellery-bangles': {
    href: '/primehubmall/salemela',
    label: 'Open PrimeHubMall Sale Mela',
    kind: 'sale',
  },
  '/category/metal-bangles': {
    href: '/primehubmall/salemela#bucket-wholesale',
    label: 'Open PrimeHubMall Wholesale Deals',
    kind: 'wholesale',
  },
} as const;

export default function CategorySwiper({
  initialCategories = [],
  liveUpdates = true,
}: {
  initialCategories?: Category[];
  liveUpdates?: boolean;
}) {
  const router = useRouter();
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

  if (!visible.length) return null;

  return (
    <section className="home-categories mx-auto mt-7 max-w-6xl px-4">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#0F6A5F]">Browse the collection</p>
          <h2 className="mt-0.5 font-[family-name:var(--font-display)] text-base font-black tracking-tight">Shop by Category</h2>
        </div>
        <Link
          href="/category"
          prefetch
          onPointerEnter={() => router.prefetch('/category')}
          onPointerDown={() => router.prefetch('/category')}
          onFocus={() => router.prefetch('/category')}
          className="flex items-center gap-0.5 rounded-full bg-white px-2.5 py-1.5 text-[10px] font-black text-[#0F6A5F] shadow-sm ring-1 ring-black/5"
        >
          View all <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto overflow-y-visible touch-pan-x touch-pan-y cursor-grab active:cursor-grabbing snap-x snap-mandatory overscroll-x-contain scroll-smooth pb-3 [scrollbar-width:none] lg:[scrollbar-width:thin] lg:[scrollbar-color:#9ca3af_transparent] [&::-webkit-scrollbar]:hidden lg:[&::-webkit-scrollbar]:block lg:[&::-webkit-scrollbar]:h-1.5 lg:[&::-webkit-scrollbar-thumb]:rounded-full lg:[&::-webkit-scrollbar-thumb]:bg-black/25">
        {visible.map((category, index) => {
          const aboveTheFold = index < ABOVE_THE_FOLD_CATEGORY_IMAGES;
          const href = categoryHref(category);
          const shortcut = CATEGORY_SHORTCUTS[href as keyof typeof CATEGORY_SHORTCUTS];
          const ShortcutIcon = shortcut?.kind === 'sale' ? BadgePercent : Package;
          const image = normalizeImageUrl(category.iconUrl || category.imageUrl || '');
          return (
            <div key={category.id} className="relative w-[92px] shrink-0 snap-start text-center lg:w-[78px]">
              {shortcut ? (
                <Link
                  href={shortcut.href}
                  prefetch={false}
                  onPointerDown={() => router.prefetch(shortcut.href)}
                  onFocus={() => router.prefetch(shortcut.href)}
                  aria-label={shortcut.label}
                  className={
                    shortcut.kind === 'sale'
                      ? "absolute right-0 top-0 z-10 flex h-7 w-7 -translate-y-1/4 translate-x-1/4 items-center justify-center rounded-full border-2 border-white bg-[#E1352B] text-white shadow-md transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E1352B]"
                      : "absolute right-0 top-0 z-10 flex h-7 w-7 -translate-y-1/4 translate-x-1/4 items-center justify-center rounded-full border-2 border-white bg-[#0F6A5F] text-white shadow-md transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F6A5F]"
                  }
                >
                  <ShortcutIcon size={14} strokeWidth={2.6} aria-hidden="true" />
                  <span className="sr-only">{shortcut.label}</span>
                </Link>
              ) : null}
              <Link
                href={href}
                prefetch={false}
                onPointerDown={() => router.prefetch(href)}
                onFocus={() => router.prefetch(href)}
                className="group block text-center"
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
            </div>
          );
        })}
      </div>
    </section>
  );
}

