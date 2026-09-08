'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useShopCatalog } from './shop/useShopCatalog';
import CatalogHeader from './shop/CatalogHeader';
import BudgetBuckets from './shop/BudgetBuckets';
import CategoryFilter from './shop/CategoryFilter';
import { FilterDrawer } from './shop/CatalogFilters';
import CatalogProductGrid from './shop/CatalogProductGrid';
import CompactCategoryStrip from './shop/CompactCategoryStrip';
import { productMatchesCategory } from '@/lib/categoryUtils';
import type { Product, Category } from './shop/ShopTypes';

function score(id: string) {
  return Array.from(id).reduce((n, c) => ((n * 31 + c.charCodeAt(0)) >>> 0), 7);
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

  const recommendations = useMemo(() => {
    if (categoryView) {
      return [...shop.products]
        .filter(
          (product) =>
            product.published !== false &&
            !productMatchesCategory(
              shop.category,
              product,
              shop.categories,
            ),
        )
        .sort((a, b) => score(a.id) - score(b.id));
    }

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
  }, [
    categoryView,
    budgetView,
    shop.category,
    shop.categories,
    shop.filtered,
    shop.products,
  ]);

  const clearAll = () => {
    shop.setSearch('');
    shop.setCategory(initialCategory || 'all');
    shop.setMaxPrice('all');
    shop.setOnlyDeals(false);
    shop.setWholesaleOnly(false);
    shop.setFiltersOpen(false);
  };

  const primaryProducts =
    categoryView || searchView || budgetView ? shop.filtered : picks;

  const selectedBucketTitle =
    bucketParam === 'wholesale'
      ? 'Wholesale Deals'
      : shop.buckets.find(
          (bucket) => Number(bucket.amount) === numericBucket,
        )?.title || `Under Rs. ${numericBucket.toLocaleString()}`;

  const eyebrow = categoryView
    ? 'Category products'
    : searchView
      ? 'Smart search'
      : budgetView
        ? 'Sale Mela collection'
        : 'Picked for you';

  const heading = categoryView
    ? shop.categoryLabel
    : searchView
      ? `${shop.filtered.length} result${shop.filtered.length === 1 ? '' : 's'} for “${shop.search.trim()}”`
      : budgetView
        ? selectedBucketTitle
        : '✨ Just For You';

  return (
    <main className="min-h-screen bg-[#F4F4F1] pb-28">
      <div className="mx-auto max-w-6xl px-4 py-5 md:px-6">
        <CatalogHeader
          search={shop.search}
          count={shop.filtered.length}
          setSearch={shop.setSearch}
          title={categoryView ? shop.categoryLabel : undefined}
          setFiltersOpen={shop.setFiltersOpen}
          onlyDeals={shop.onlyDeals}
          setOnlyDeals={shop.setOnlyDeals}
        />

        {!categoryView && (
          <CompactCategoryStrip categories={shop.categories} />
        )}

        <BudgetBuckets
          buckets={shop.buckets}
          maxPrice={shop.maxPrice}
          setMaxPrice={shop.setMaxPrice}
          wholesaleOnly={shop.wholesaleOnly}
          setWholesaleOnly={shop.setWholesaleOnly}
        />

        {categoryView && (
          <CategoryFilter
            categories={shop.categories}
            category={shop.category}
            setCategory={shop.setCategory}
          />
        )}

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
            dense={!categoryView}
          />
        </section>

        {(categoryView || budgetView) && recommendations.length > 0 && (
          <section className="mt-10 border-t border-black/5 pt-7">
            <div className="mb-3">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#0F6A5F]">
                {budgetView ? 'More products' : 'Recommended'}
              </p>
              <h2 className="mt-0.5 text-xl font-black tracking-tight">
                {budgetView ? '✨ More to Explore' : '✨ Just For You'}
              </h2>
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
