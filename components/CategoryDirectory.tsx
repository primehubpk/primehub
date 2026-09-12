'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Grid3X3 } from 'lucide-react';
import { categoryHref } from '@/lib/categoryUtils';
import { normalizeImageUrl } from '@/lib/imageUrl';
import { cacheCatalogForNavigation, readCachedCatalog } from '@/lib/productNavigationCache';
import type { Category } from '@/lib/types';

type CacheProduct = { id?: unknown };

export default function CategoryDirectory() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const cached = readCachedCatalog<CacheProduct, Category>();

    if (cached?.categories.length) {
      setCategories(cached.categories);
      setLoading(false);
    }

    async function refreshCatalog() {
      try {
        const response = await fetch('/api/storefront/read?type=catalog', { cache: 'no-store' });
        if (!response.ok) throw new Error(`catalog read ${response.status}`);
        const data = await response.json();
        if (cancelled) return;

        const nextProducts = Array.isArray(data?.products) ? data.products as CacheProduct[] : [];
        const nextCategories = Array.isArray(data?.categories) ? data.categories as Category[] : [];
        if (nextCategories.length) setCategories(nextCategories);
        cacheCatalogForNavigation(nextProducts, nextCategories);
      } catch (error) {
        console.warn('Category directory refresh unavailable', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void refreshCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(
    () => [...categories]
      .filter((category) => category.active !== false && String(category.title || '').trim())
      .sort((a, b) => Number(a.sortOrder ?? 999) - Number(b.sortOrder ?? 999) || a.title.localeCompare(b.title)),
    [categories],
  );

  useEffect(() => {
    if (!visible.length) return;
    const warm = () => visible.slice(0, 12).forEach((category) => router.prefetch(categoryHref(category)));
    const browser = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (browser.requestIdleCallback) {
      const id = browser.requestIdleCallback(warm, { timeout: 900 });
      return () => browser.cancelIdleCallback?.(id);
    }

    const timer = window.setTimeout(warm, 150);
    return () => window.clearTimeout(timer);
  }, [router, visible]);

  return (
    <main className="min-h-screen bg-[#F4F4F1] px-4 pb-28 pt-5 md:px-6">
      <section className="mx-auto max-w-6xl">
        <div className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-black/5">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#0F6A5F] text-white">
              <Grid3X3 size={20} />
            </span>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#0F6A5F]">Browse the collection</p>
              <h1 className="mt-0.5 text-2xl font-black tracking-tight text-[#14140F]">All Categories</h1>
              <p className="mt-1 text-xs leading-5 text-black/45">Choose a category to see only its products.</p>
            </div>
          </div>
        </div>

        {loading && !visible.length ? (
          <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {Array.from({ length: 12 }, (_, index) => (
              <div key={index} className="animate-pulse rounded-[22px] bg-white p-3 shadow-sm">
                <div className="mx-auto aspect-square w-full rounded-2xl bg-black/[0.06]" />
                <div className="mx-auto mt-3 h-3 w-4/5 rounded-full bg-black/[0.07]" />
              </div>
            ))}
          </div>
        ) : visible.length ? (
          <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {visible.map((category, index) => {
              const href = categoryHref(category);
              const image = normalizeImageUrl(category.iconUrl || category.imageUrl || '');
              const eager = index < 9;
              return (
                <Link
                  key={category.id}
                  href={href}
                  prefetch
                  onPointerEnter={() => router.prefetch(href)}
                  onPointerDown={() => router.prefetch(href)}
                  onFocus={() => router.prefetch(href)}
                  className="group min-w-0 rounded-[22px] bg-white p-2.5 text-center shadow-sm ring-1 ring-black/5 transition active:scale-[0.98]"
                >
                  <span className="relative mx-auto flex aspect-square w-full overflow-hidden rounded-2xl bg-[#EEEDE8]">
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
                      <span className="m-auto text-2xl font-black text-[#0F6A5F]">{category.title.charAt(0)}</span>
                    )}
                  </span>
                  <span className="mt-2 flex items-center justify-center gap-0.5 text-[10px] font-black text-[#14140F]">
                    <span className="truncate">{category.title}</span>
                    <ChevronRight className="h-3 w-3 shrink-0 text-black/25 transition group-hover:translate-x-0.5" />
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 rounded-[28px] bg-white p-8 text-center text-sm font-bold text-black/45 shadow-sm">
            Categories are refreshing. Please try again in a moment.
          </div>
        )}
      </section>
    </main>
  );
}
