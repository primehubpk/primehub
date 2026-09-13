'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import HomeHeader from '@/components/home/HomeHeader';
import './home/home.css';
import { useShopCatalog } from './shop/useShopCatalog';
import CatalogHeader from './shop/CatalogHeader';
import BudgetBuckets from './shop/BudgetBuckets';
import CategoryFilter from './shop/CategoryFilter';
import { FilterDrawer } from './shop/CatalogFilters';
import CatalogProductGrid from './shop/CatalogProductGrid';
import CompactCategoryStrip from './shop/CompactCategoryStrip';
import { categoryHref, productMatchesCategory, slugifyCategory } from '@/lib/categoryUtils';
import type { Product, Category } from './shop/ShopTypes';

function score(id: string) {
  return Array.from(id).reduce((n, c) => ((n * 31 + c.charCodeAt(0)) >>> 0), 7);
}

function updatedTime(product: Product) {
  const value = (product as Product & { updatedAt?: string; createdAt?: string }).updatedAt
    || (product as Product & { createdAt?: string }).createdAt
    || '';
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function categoryLabel(category: Category) {
  return category.name || category.title || category.id || 'Category';
}

function categoryValue(category: Category) {
  return slugifyCategory(category.title || category.name || category.slug || category.id || '');
}

type Props = {
  initialCategory?: string;
  initialQuery?: string;
  initialProducts?: Product[];
  initialCategories?: Category[];
};

export default function ShopCatalog({
  initialCategory,
  initialQuery = '',
  initialProducts = [],
  initialCategories = [],
}: Props) {
  const shop = useShopCatalog(
    initialCategory,
    initialQuery,
    initialProducts,
    initialCategories,
  );
  const searchParams = useSearchParams();
  const bucketParam = searchParams.get('bucket') || '';
  const numericBucket = Number(bucketParam);
  const categoryView = Boolean(initialCategory);
  const searchView = Boolean(shop.search.trim());
  const budgetView =
    !categoryView &&
    !searchView &&
    (bucketParam === 'wholesale'
      ? shop.wholesaleOnly
      : numericBucket > 0 && shop.maxPrice === String(numericBucket));

  const picks = useMemo(
    () => [...shop.filtered].sort((a, b) => score(a.id) - score(b.id)),
    [shop.filtered],
  );

  const categoryProducts = useMemo(
    () => [...shop.filtered].sort(
      (a, b) => updatedTime(b) - updatedTime(a) || score(a.id) - score(b.id),
    ),
    [shop.filtered],
  );

  const activeCategories = useMemo(
    () => shop.categories.filter((category) => category.active !== false),
    [shop.categories],
  );

  const categorySections = useMemo(() => {
    if (!categoryView) return [];

    return activeCategories
      .map((category) => {
        const value = categoryValue(category);
        const products = shop.products
          .filter(
            (product) =>
              product.published !== false &&
              productMatchesCategory(value, product, shop.categories),
          )
          .sort((a, b) => updatedTime(b) - updatedTime(a) || score(a.id) - score(b.id));

        const selected = productMatchesCategory(
          shop.category,
          { category: category.title || category.name, categoryId: category.id },
          [category],
        );

        return { category, value, products, selected };
      })
      .filter((section) => section.products.length > 0);
  }, [activeCategories, categoryView, shop.category, shop.categories, shop.products]);

  const currentSection = useMemo(
    () => categorySections.find((section) => section.selected),
    [categorySections],
  );

  const followingSections = useMemo(
    () => categorySections.filter((section) => !section.selected),
    [categorySections],
  );

  const recommendations = useMemo(() => {
    if (budgetView) {
      const selectedIds = new Set(shop.filtered.map((product) => product.id));
      return [...shop.products]
        .filter(
          (product) =>
            product.published !== false && !selectedIds.has(product.id),
        )
        .sort((a, b) => score(a.id) - score(b.id));
    }

    return [];
  }, [budgetView, shop.filtered, shop.products]);

  const clearAll = () => {
    shop.setSearch('');
    shop.setCategory(initialCategory || 'all');
    shop.setMaxPrice('all');
    shop.setOnlyDeals(false);
    shop.setWholesaleOnly(false);
    shop.setFiltersOpen(false);
  };

  const primaryProducts = searchView || budgetView ? shop.filtered : picks;

  const selectedBucketTitle =
    shop.wholesaleOnly || bucketParam === 'wholesale'
      ? 'Wholesale Deals'
      : shop.buckets.find(
          (bucket) => Number(bucket.amount) === numericBucket,
        )?.title || `Under Rs. ${numericBucket.toLocaleString()}`;

  const eyebrow = searchView
    ? 'Smart search'
    : budgetView
      ? 'Budget collection'
      : 'Picked for you';

  const heading = searchView
    ? `${shop.filtered.length} result${shop.filtered.length === 1 ? '' : 's'} for “${shop.search.trim()}”`
    : budgetView
      ? selectedBucketTitle
      : '✨ Just For You';

  if (categoryView) {
    const selectedCategory = currentSection?.category;
    const selectedProducts = currentSection?.products || categoryProducts;
    const selectedLabel = selectedCategory ? categoryLabel(selectedCategory) : shop.categoryLabel;
    const selectedIcon = selectedCategory?.iconUrl || selectedCategory?.imageUrl || selectedCategory?.image;

    return (
      <div className="home-storefront min-h-screen bg-[#F8F5EF] pb-28">
        <HomeHeader />

        <main className="mx-auto max-w-6xl px-3 pb-10 pt-4 sm:px-4 md:px-6">
          <section className="rounded-[28px] border border-[#E9E1D5] bg-white/90 px-4 py-4 shadow-[0_12px_38px_rgba(70,52,29,0.07)] backdrop-blur sm:px-5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[8px] font-black uppercase tracking-[0.22em] text-[#A66B17]">Category collection</p>
                <h1 className="mt-1 text-2xl font-black tracking-tight text-[#211B14] sm:text-3xl">{selectedLabel}</h1>
                <p className="mt-1 text-[11px] font-semibold text-black/45">Browse every available product in this collection.</p>
              </div>
              <span className="shrink-0 rounded-full bg-[#FFF6E8] px-3 py-1.5 text-[10px] font-black text-[#8B5A12] ring-1 ring-[#ECD9B8]">
                {selectedProducts.length} products
              </span>
            </div>

            <div className="mt-4 flex">
              <div className="flex w-[92px] flex-col items-center gap-2 text-center">
                <span className="flex h-[78px] w-[78px] items-center justify-center overflow-hidden rounded-[24px] border border-[#C58A2A] bg-[#FFF9F0] p-1.5 shadow-[0_8px_24px_rgba(83,58,22,0.08)] ring-2 ring-[#C58A2A]/10">
                  {selectedIcon ? (
                    <img src={selectedIcon} alt="" className="h-full w-full rounded-[19px] object-cover" />
                  ) : (
                    <span className="text-2xl font-black text-[#A66B17]">{selectedLabel.charAt(0)}</span>
                  )}
                </span>
                <span className="line-clamp-2 text-[10px] font-black leading-3.5 text-[#8B5A12]">{selectedLabel}</span>
              </div>
            </div>
          </section>

          <section className="mt-6">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-[8px] font-black uppercase tracking-[0.2em] text-[#B7791F]">{selectedLabel}</p>
                <h2 className="mt-0.5 text-xl font-black tracking-tight text-[#211B14] sm:text-2xl">All {selectedLabel} products</h2>
              </div>
              <span className="text-[10px] font-bold text-black/40">{selectedProducts.length} items</span>
            </div>
            <CatalogProductGrid
              products={selectedProducts}
              addedId={shop.addedId}
              addProduct={shop.addProduct}
              loading={shop.loading}
              premium
            />
          </section>

          {activeCategories.length > 0 && (
            <CategoryFilter
              categories={activeCategories}
              category={shop.category}
              title="Explore all categories"
            />
          )}

          {followingSections.map((section, index) => {
            const label = categoryLabel(section.category);
            return (
              <div key={section.category.id || section.value}>
                <section className="mt-9 border-t border-[#E7DED1] pt-7">
                  <div className="mb-3 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[8px] font-black uppercase tracking-[0.2em] text-[#0F6A5F]">Next collection</p>
                      <h2 className="mt-0.5 text-xl font-black tracking-tight text-[#211B14] sm:text-2xl">{label}</h2>
                      <p className="mt-1 text-[10px] font-semibold text-black/40">Continue exploring the PrimeHub collection.</p>
                    </div>
                    <Link
                      href={categoryHref(section.category)}
                      prefetch={false}
                      className="flex shrink-0 items-center gap-0.5 rounded-full bg-white px-3 py-2 text-[9px] font-black text-[#74501B] shadow-sm ring-1 ring-black/5 transition active:scale-95"
                    >
                      Open category <ChevronRight size={13} />
                    </Link>
                  </div>

                  <CatalogProductGrid
                    products={section.products}
                    addedId={shop.addedId}
                    addProduct={shop.addProduct}
                    loading={shop.loading}
                    premium
                  />
                </section>

                {index < followingSections.length - 1 && activeCategories.length > 0 && (
                  <CategoryFilter
                    categories={activeCategories}
                    category={section.value}
                    title="Explore all categories"
                  />
                )}
              </div>
            );
          })}
        </main>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#F4F4F1] pb-28">
      <div className="mx-auto max-w-6xl px-4 py-5 md:px-6">
        <CatalogHeader
          search={shop.search}
          count={shop.filtered.length}
          setSearch={shop.setSearch}
          setFiltersOpen={shop.setFiltersOpen}
          onlyDeals={shop.onlyDeals}
          setOnlyDeals={shop.setOnlyDeals}
        />

        <CompactCategoryStrip categories={shop.categories} />

        <BudgetBuckets
          buckets={shop.buckets}
          maxPrice={shop.maxPrice}
          setMaxPrice={shop.setMaxPrice}
          wholesaleOnly={shop.wholesaleOnly}
          setWholesaleOnly={shop.setWholesaleOnly}
        />

        <section className="mt-6">
          <div className="mb-3">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#E1352B]">
              {eyebrow}
            </p>
            <h2 className="mt-0.5 text-xl font-black tracking-tight">
              {heading}
            </h2>
            {searchView && shop.filtered.length === 0 && (
              <p className="mt-1 text-xs font-semibold text-black/45">
                Try a shorter word, category name, or a similar spelling.
              </p>
            )}
          </div>

          <CatalogProductGrid
            products={primaryProducts}
            addedId={shop.addedId}
            addProduct={shop.addProduct}
            loading={shop.loading}
            dense
          />
        </section>

        {budgetView && recommendations.length > 0 && (
          <section className="mt-10 border-t border-black/5 pt-7">
            <div className="mb-3">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#0F6A5F]">More products</p>
              <h2 className="mt-0.5 text-xl font-black tracking-tight">✨ More to Explore</h2>
            </div>
            <CatalogProductGrid
              products={recommendations}
              addedId={shop.addedId}
              addProduct={shop.addProduct}
              loading={shop.loading}
              dense
            />
          </section>
        )}
      </div>

      <FilterDrawer
        filtersOpen={shop.filtersOpen}
        setFiltersOpen={shop.setFiltersOpen}
        maxPrice={shop.maxPrice}
        setMaxPrice={shop.setMaxPrice}
        onlyDeals={shop.onlyDeals}
        setOnlyDeals={shop.setOnlyDeals}
        clearAll={clearAll}
      />
    </main>
  );
}
