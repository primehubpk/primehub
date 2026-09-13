'use client';

import Link from 'next/link';
import { useMemo } from 'react';
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

function categoryWords(label: string) {
  return slugifyCategory(label)
    .split('-')
    .filter((word) => word.length > 2 && !['collection', 'collections', 'deal', 'deals'].includes(word));
}

function relatedScore(selectedLabel: string, candidateLabel: string) {
  const selected = new Set(categoryWords(selectedLabel));
  const candidate = categoryWords(candidateLabel);
  let scoreValue = candidate.reduce((total, word) => total + (selected.has(word) ? 4 : 0), 0);

  if (selected.has('bangles') && candidate.includes('bangles')) scoreValue += 8;
  if (selected.has('jewellery') && candidate.includes('jewellery')) scoreValue += 6;
  if (selected.has('jewelry') && candidate.includes('jewelry')) scoreValue += 6;

  return scoreValue;
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

  const followingSections = useMemo(() => {
    const remaining = categorySections.filter((section) => !section.selected);
    if (!currentSection) return remaining;

    const selectedLabel = categoryLabel(currentSection.category);
    const sourceOrder = new Map(
      categorySections.map((section, index) => [section.value, index]),
    );

    return [...remaining].sort((a, b) => {
      const relationDifference =
        relatedScore(selectedLabel, categoryLabel(b.category)) -
        relatedScore(selectedLabel, categoryLabel(a.category));

      if (relationDifference !== 0) return relationDifference;
      return (sourceOrder.get(a.value) || 0) - (sourceOrder.get(b.value) || 0);
    });
  }, [categorySections, currentSection]);

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
      <div className="home-storefront min-h-screen bg-[#FFFCF7] pb-28">
        <HomeHeader />

        <main className="mx-auto w-full max-w-[900px] px-3 pb-10 pt-3 sm:px-4 md:px-5">
          <Link
            href="/"
            prefetch
            className="mb-4 inline-flex items-center rounded-full bg-white px-3 py-2 text-[10px] font-black text-[#0F6A5F] shadow-sm ring-1 ring-black/5 transition active:scale-95"
          >
            ← Back to Home
          </Link>

          <section aria-label={`${selectedLabel} category`}>
            <div className="mb-3 px-0.5">
              {selectedCategory ? (
                <Link
                  href={categoryHref(selectedCategory)}
                  prefetch
                  className="group inline-flex items-center justify-center rounded-[24px] focus-visible:outline-none"
                  aria-label={`Open ${selectedLabel} category`}
                >
                  <span className="flex h-[76px] w-[76px] items-center justify-center overflow-hidden rounded-[24px] border border-[#C58A2A] bg-[#FFF9F0] p-1.5 shadow-[0_8px_24px_rgba(83,58,22,0.09)] ring-2 ring-[#C58A2A]/10 transition group-active:scale-95">
                    {selectedIcon ? (
                      <img src={selectedIcon} alt="" className="h-full w-full rounded-[19px] object-cover" />
                    ) : (
                      <span className="text-2xl font-black text-[#A66B17]">{selectedLabel.charAt(0)}</span>
                    )}
                  </span>
                </Link>
              ) : (
                <span className="flex h-[76px] w-[76px] items-center justify-center rounded-[24px] border border-[#C58A2A] bg-[#FFF9F0] text-2xl font-black text-[#A66B17] shadow-[0_8px_24px_rgba(83,58,22,0.09)] ring-2 ring-[#C58A2A]/10">
                  {selectedLabel.charAt(0)}
                </span>
              )}

              <div className="mt-3 flex items-end justify-between gap-3">
                <h1 className="text-[25px] font-black leading-none tracking-[-0.035em] text-[#211B14] sm:text-[30px]">
                  {selectedLabel}
                </h1>
                <span className="shrink-0 pb-0.5 text-[10px] font-bold text-black/45 sm:text-[11px]">
                  {selectedProducts.length} products
                </span>
              </div>
            </div>

            <CatalogProductGrid
              products={selectedProducts}
              addedId={shop.addedId}
              addProduct={shop.addProduct}
              loading={shop.loading}
              premium
            />
          </section>

          {activeCategories.length > 1 && (
            <CategoryFilter
              categories={activeCategories}
              category={shop.category}
              title="Shop by Category"
            />
          )}

          {followingSections.map((section) => {
            const label = categoryLabel(section.category);
            const icon = section.category.iconUrl || section.category.imageUrl || section.category.image;

            return (
              <section
                key={section.category.id || section.value}
                className="mt-9 border-t border-[#E7DED1]/80 pt-6"
              >
                <div className="mb-3 px-0.5">
                  <Link
                    href={categoryHref(section.category)}
                    prefetch
                    className="group inline-flex items-center justify-center rounded-[24px] focus-visible:outline-none"
                    aria-label={`Open ${label} category`}
                  >
                    <span className="flex h-[76px] w-[76px] items-center justify-center overflow-hidden rounded-[24px] border border-[#C58A2A] bg-[#FFF9F0] p-1.5 shadow-[0_8px_24px_rgba(83,58,22,0.09)] ring-2 ring-[#C58A2A]/10 transition group-active:scale-95">
                      {icon ? (
                        <img src={icon} alt="" className="h-full w-full rounded-[19px] object-cover" />
                      ) : (
                        <span className="text-2xl font-black text-[#A66B17]">{label.charAt(0)}</span>
                      )}
                    </span>
                  </Link>

                  <div className="mt-3 flex items-end justify-between gap-3">
                    <h2 className="min-w-0 text-[25px] font-black leading-none tracking-[-0.035em] text-[#211B14] sm:text-[30px]">
                      {label}
                    </h2>
                    <span className="shrink-0 pb-0.5 text-[10px] font-bold text-black/45 sm:text-[11px]">
                      {section.products.length} products
                    </span>
                  </div>
                </div>

                <CatalogProductGrid
                  products={section.products}
                  addedId={shop.addedId}
                  addProduct={shop.addProduct}
                  loading={shop.loading}
                  premium
                />
              </section>
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
