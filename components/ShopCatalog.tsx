'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { ArrowDownUp, ChevronRight, Filter, Search, SlidersHorizontal, X } from 'lucide-react';
import { db } from '@/lib/firebase';

type Product = {
  id: string;
  title?: string;
  name?: string;
  price?: number;
  compareAtPrice?: number;
  originalPrice?: number;
  imageUrl?: string;
  image?: string;
  images?: string[];
  category?: string;
  categoryId?: string;
  stock?: number;
  isFlashSale?: boolean;
  [key: string]: any;
};

type Category = {
  id: string;
  name?: string;
  title?: string;
  slug?: string;
  imageUrl?: string;
  image?: string;
  [key: string]: any;
};

function titleOf(p: Product) {
  return p.title || p.name || 'PrimeHub Deal';
}
function imageOf(p: Product) {
  return p.imageUrl || p.image || p.images?.[0] || '';
}
function priceOf(p: Product) {
  return Number(p.price || 0);
}
function originalOf(p: Product) {
  return Number(p.compareAtPrice ?? p.originalPrice ?? 0);
}
function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export default function ShopCatalog({
  initialCategory,
  initialQuery = '',
}: {
  initialCategory?: string;
  initialQuery?: string;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory || 'all');
  const [sort, setSort] = useState('featured');
  const [maxPrice, setMaxPrice] = useState('all');
  const [onlyDeals, setOnlyDeals] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [productSnap, categorySnap] = await Promise.all([
          getDocs(collection(db, 'products')),
          getDocs(collection(db, 'categories')),
        ]);

        if (cancelled) return;

        const nextProducts = productSnap.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as Product)
        );
        const nextCategories = categorySnap.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as Category)
        );

        setProducts(nextProducts);
        setCategories(nextCategories);
      } catch {
        if (!cancelled) {
          setProducts([]);
          setCategories([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    const result = products.filter((p) => {
      const title = titleOf(p).toLowerCase();
      const cat = String(p.category || '').toLowerCase();
      const catId = String(p.categoryId || '').toLowerCase();

      const matchesSearch =
        !q ||
        title.includes(q) ||
        cat.includes(q) ||
        catId.includes(q);

      const selectedCat =
        category === 'all' ||
        cat === category.toLowerCase() ||
        catId === category.toLowerCase() ||
        slugify(cat) === category.toLowerCase();

      const price = priceOf(p);
      const matchesPrice =
        maxPrice === 'all' ||
        (maxPrice === '99' && price <= 99) ||
        (maxPrice === '300' && price <= 300) ||
        (maxPrice === '500' && price <= 500) ||
        (maxPrice === '1000' && price <= 1000);

      const matchesDeal = !onlyDeals || Boolean(p.isFlashSale);

      return matchesSearch && selectedCat && matchesPrice && matchesDeal;
    });

    return [...result].sort((a, b) => {
      if (sort === 'price-low') return priceOf(a) - priceOf(b);
      if (sort === 'price-high') return priceOf(b) - priceOf(a);
      if (sort === 'name') return titleOf(a).localeCompare(titleOf(b));
      return 0;
    });
  }, [products, search, category, sort, maxPrice, onlyDeals]);

  return (
    <main className="min-h-screen bg-[#F4F4F1] pb-28">
      <div className="mx-auto max-w-6xl px-4 py-5 md:px-6">
        <div className="rounded-[28px] bg-[#14140F] p-5 text-white shadow-xl md:p-7">
          <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[#FFB020]">
            PrimeHub Deals
          </p>
          <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight md:text-4xl">
                Shop the deals.
              </h1>
              <p className="mt-1 max-w-xl text-xs leading-5 text-white/50">
                Explore every product, filter your budget and discover your next bargain.
              </p>
            </div>
            <p className="text-[10px] font-black text-white/40">
              {filtered.length} {filtered.length === 1 ? 'deal' : 'deals'}
            </p>
          </div>

          <div className="mt-5 flex items-center gap-2 rounded-2xl bg-white px-3 py-2">
            <Search size={17} className="shrink-0 text-black/35" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products, categories..."
              className="min-w-0 flex-1 bg-transparent py-2 text-xs font-bold text-[#14140F] outline-none placeholder:text-black/30"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} aria-label="Clear search">
                <X size={16} className="text-black/35" />
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setCategory('all')}
            className={`shrink-0 rounded-full px-4 py-2.5 text-[10px] font-black ${
              category === 'all' ? 'bg-[#E1352B] text-white' : 'bg-white text-[#14140F]'
            }`}
          >
            All Deals
          </button>
          {categories.map((cat) => {
            const value = cat.slug || slugify(cat.name || cat.title || cat.id);
            const label = cat.name || cat.title || cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(value)}
                className={`shrink-0 rounded-full px-4 py-2.5 text-[10px] font-black ${
                  category === value ? 'bg-[#E1352B] text-white' : 'bg-white text-[#14140F]'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-[10px] font-black shadow-sm"
          >
            <SlidersHorizontal size={14} />
            Filters
          </button>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-2xl bg-white px-3 py-3 text-[10px] font-black outline-none shadow-sm"
            aria-label="Sort products"
          >
            <option value="featured">Featured</option>
            <option value="price-low">Price: Low → High</option>
            <option value="price-high">Price: High → Low</option>
            <option value="name">Name A → Z</option>
          </select>
        </div>

        <section className="mt-5">
          {loading ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="overflow-hidden rounded-[22px] bg-white">
                  <div className="aspect-square animate-pulse bg-black/8" />
                  <div className="space-y-2 p-3">
                    <div className="h-3 w-4/5 animate-pulse rounded bg-black/8" />
                    <div className="h-4 w-1/2 animate-pulse rounded bg-black/8" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-[28px] bg-white p-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F4F4F1]">
                <Search size={20} className="text-black/30" />
              </div>
              <h2 className="mt-4 text-base font-black">No deals found</h2>
              <p className="mt-1 text-xs text-black/40">
                Try another search or clear your filters.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setCategory('all');
                  setMaxPrice('all');
                  setOnlyDeals(false);
                }}
                className="mt-4 rounded-full bg-[#14140F] px-5 py-2.5 text-[10px] font-black text-white"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {filtered.map((product) => {
                const price = priceOf(product);
                const original = originalOf(product);
                const discount =
                  original > price && price > 0
                    ? Math.round(((original - price) / original) * 100)
                    : 0;

                return (
                  <Link
                    key={product.id}
                    href={`/product/${product.id}`}
                    className="group overflow-hidden rounded-[22px] border border-black/6 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    <div className="relative aspect-square overflow-hidden bg-[#F4F4F1]">
                      {imageOf(product) ? (
                        <img
                          src={imageOf(product)}
                          alt={titleOf(product)}
                          loading="lazy"
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[10px] font-bold text-black/25">
                          No image
                        </div>
                      )}

                      <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                        {discount > 0 && (
                          <span className="rounded-full bg-[#E1352B] px-2 py-1 text-[8px] font-black text-white">
                            -{discount}%
                          </span>
                        )}
                        {product.isFlashSale && (
                          <span className="rounded-full bg-[#14140F] px-2 py-1 text-[8px] font-black text-white">
                            FLASH
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-3">
                      <p className="line-clamp-2 min-h-[30px] text-[11px] font-black leading-4">
                        {titleOf(product)}
                      </p>
                      <div className="mt-2 flex items-end gap-1.5">
                        <span className="font-[family-name:var(--font-mono)] text-sm font-black text-[#E1352B]">
                          Rs. {price.toLocaleString()}
                        </span>
                        {original > price && (
                          <span className="text-[9px] text-black/30 line-through">
                            Rs. {original.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {filtersOpen && (
        <div className="fixed inset-0 z-[100]">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            onClick={() => setFiltersOpen(false)}
            aria-label="Close filters"
          />
          <div className="absolute bottom-0 left-0 right-0 rounded-t-[30px] bg-white p-5 shadow-2xl md:left-1/2 md:right-auto md:top-1/2 md:w-[420px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[30px]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#E1352B]">
                  Refine
                </p>
                <h2 className="mt-1 text-lg font-black">Shop Filters</h2>
              </div>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F4F4F1]"
              >
                <X size={15} />
              </button>
            </div>

            <div className="mt-6">
              <p className="text-[10px] font-black uppercase tracking-wider text-black/40">
                Price
              </p>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {[
                  ['all', 'Any'],
                  ['99', 'Under 99'],
                  ['499', 'Under 499'],
                  ['999', 'Under 999'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMaxPrice(value)}
                    className={`rounded-2xl px-2 py-3 text-[9px] font-black ${
                      maxPrice === value
                        ? 'bg-[#14140F] text-white'
                        : 'bg-[#F4F4F1] text-[#14140F]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setOnlyDeals((v) => !v)}
              className={`mt-4 flex w-full items-center justify-between rounded-2xl p-4 text-left ${
                onlyDeals ? 'bg-[#E1352B] text-white' : 'bg-[#F4F4F1] text-[#14140F]'
              }`}
            >
              <span>
                <span className="block text-[11px] font-black">Flash Deals only</span>
                <span className="mt-0.5 block text-[9px] opacity-60">
                  Show products marked as flash sales
                </span>
              </span>
              <span className="text-[10px] font-black">{onlyDeals ? 'ON' : 'OFF'}</span>
            </button>

            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              className="mt-5 w-full rounded-2xl bg-[#14140F] py-4 text-xs font-black text-white"
            >
              Show {filtered.length} Deals
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
