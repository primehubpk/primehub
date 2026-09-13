'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  BadgeCheck,
  Flame,
  Grid2X2,
  PackageCheck,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Truck,
} from 'lucide-react';
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
import {
  availableStockOf,
  discountOf,
  imageOf,
  priceOf,
  type Product,
  type Category,
} from './shop/ShopTypes';

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

function textValues(value: unknown): string[] {
  if (value == null) return [];
  if (typeof value === 'string' || typeof value === 'number') return [String(value).trim()].filter(Boolean);
  if (Array.isArray(value)) return value.flatMap(textValues);
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return textValues(record.name ?? record.label ?? record.value ?? record.title ?? record.color);
  }
  return [];
}

function productOptions(product: Product, keys: string[]) {
  const values = keys.flatMap((key) => textValues(product[key]));
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function salesScore(product: Product) {
  return Number(
    product.salesCount
    ?? product.soldCount
    ?? product.totalSold
    ?? product.ordersCount
    ?? product.orderCount
    ?? product.reviewCount
    ?? 0,
  );
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

  const [sortMode, setSortMode] = useState(searchParams.get('sort') || 'best-selling');
  const [stockOnly, setStockOnly] = useState(false);
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState('');

  useEffect(() => {
    setSortMode(searchParams.get('sort') || 'best-selling');
  }, [searchParams]);

  const colorOptions = useMemo(() => {
    const values = shop.products.flatMap((product) => productOptions(product, ['color', 'colors', 'variantColors']));
    return Array.from(new Set(values)).slice(0, 8);
  }, [shop.products]);

  const materialOptions = useMemo(() => {
    const values = shop.products.flatMap((product) => productOptions(product, ['material', 'materials']));
    return Array.from(new Set(values)).slice(0, 7);
  }, [shop.products]);

  const storefrontProducts = useMemo(() => {
    let products = [...shop.filtered];

    if (stockOnly) products = products.filter((product) => availableStockOf(product) > 0);
    if (selectedColor) {
      const token = slugifyCategory(selectedColor);
      products = products.filter((product) =>
        productOptions(product, ['color', 'colors', 'variantColors'])
          .some((value) => slugifyCategory(value) === token),
      );
    }
    if (selectedMaterial) {
      const token = slugifyCategory(selectedMaterial);
      products = products.filter((product) =>
        productOptions(product, ['material', 'materials'])
          .some((value) => slugifyCategory(value) === token),
      );
    }

    return products.sort((a, b) => {
      if (sortMode === 'newest') return updatedTime(b) - updatedTime(a) || score(a.id) - score(b.id);
      if (sortMode === 'price-low') return priceOf(a) - priceOf(b) || score(a.id) - score(b.id);
      if (sortMode === 'price-high') return priceOf(b) - priceOf(a) || score(a.id) - score(b.id);
      if (sortMode === 'discount') return discountOf(b) - discountOf(a) || score(a.id) - score(b.id);
      return salesScore(b) - salesScore(a) || score(a.id) - score(b.id);
    });
  }, [shop.filtered, selectedColor, selectedMaterial, sortMode, stockOnly]);

  const bannerProducts = useMemo(
    () => shop.products.filter((product) => product.published !== false && imageOf(product)).slice(0, 4),
    [shop.products],
  );

  const clearAll = () => {
    shop.setSearch('');
    shop.setCategory(initialCategory || 'all');
    shop.setMaxPrice('all');
    shop.setOnlyDeals(false);
    shop.setWholesaleOnly(false);
    shop.setFiltersOpen(false);
    setStockOnly(false);
    setSelectedColor('');
    setSelectedMaterial('');
  };

  const selectedBucketTitle =
    shop.wholesaleOnly || bucketParam === 'wholesale'
      ? 'Wholesale Deals'
      : shop.buckets.find(
          (bucket) => Number(bucket.amount) === numericBucket,
        )?.title || (numericBucket > 0 ? `Under Rs. ${numericBucket.toLocaleString()}` : 'All Products');

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

  const heading = searchView
    ? `${storefrontProducts.length} result${storefrontProducts.length === 1 ? '' : 's'} for “${shop.search.trim()}”`
    : budgetView
      ? selectedBucketTitle
      : `Shop — ${storefrontProducts.length.toLocaleString()} products`;

  return (
    <main className="min-h-screen bg-[#F5F1EA] pb-28 text-[#28231D]">
      <div className="mx-auto w-full max-w-[1540px] px-2.5 py-3 sm:px-4 sm:py-4 lg:px-6">
        <CatalogHeader
          search={shop.search}
          count={storefrontProducts.length}
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

        <section className="mt-2.5 grid gap-2.5 md:grid-cols-2" aria-label="PrimeHub deals">
          <Link
            href="/deals"
            prefetch
            className="group relative min-h-[132px] overflow-hidden rounded-[22px] border border-[#CADBD5] bg-[#DDEBE6] shadow-[0_8px_24px_rgba(39,62,53,0.08)] sm:min-h-[150px]"
          >
            {bannerProducts[0] && (
              <img src={imageOf(bannerProducts[0])} alt="" className="absolute inset-y-0 right-0 h-full w-[46%] object-cover transition duration-500 group-hover:scale-[1.03]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-[#E5F0EC] via-[#DDEBE6]/95 to-transparent" />
            <div className="relative z-10 flex h-full max-w-[68%] flex-col justify-center p-4 sm:p-5">
              <div className="flex items-center gap-2 text-[#B77B08]"><Flame size={22} fill="currentColor" /><span className="text-[9px] font-black uppercase tracking-[0.18em]">Live today</span></div>
              <h2 className="mt-1 text-xl font-black tracking-[-0.04em] text-[#0B594D] sm:text-2xl">Today’s Deals</h2>
              <p className="mt-1 text-[9px] font-semibold leading-4 text-black/55 sm:text-[10px]">Premium products at special prices. Updated for today.</p>
              <span className="mt-3 w-fit rounded-full bg-[#075C4E] px-3.5 py-2 text-[8px] font-black text-white shadow-sm sm:text-[9px]">View All Deals →</span>
            </div>
          </Link>

          <Link
            href="/weekly-deals"
            prefetch
            className="group relative min-h-[132px] overflow-hidden rounded-[22px] border border-[#E9D8B9] bg-[#FFF3DE] shadow-[0_8px_24px_rgba(72,53,24,0.07)] sm:min-h-[150px]"
          >
            {bannerProducts[1] && (
              <img src={imageOf(bannerProducts[1])} alt="" className="absolute inset-y-0 right-0 h-full w-[46%] object-cover transition duration-500 group-hover:scale-[1.03]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-[#FFF5E4] via-[#FFF3DE]/95 to-transparent" />
            <div className="relative z-10 flex h-full max-w-[68%] flex-col justify-center p-4 sm:p-5">
              <div className="flex items-center gap-2 text-[#C46D16]"><Flame size={22} /><span className="text-[9px] font-black uppercase tracking-[0.18em]">Fresh every week</span></div>
              <h2 className="mt-1 text-xl font-black tracking-[-0.04em] text-[#0B594D] sm:text-2xl">Weekly Deals</h2>
              <p className="mt-1 text-[9px] font-semibold leading-4 text-black/55 sm:text-[10px]">New styles, bigger savings, and limited-time offers.</p>
              <span className="mt-3 w-fit rounded-full bg-[#075C4E] px-3.5 py-2 text-[8px] font-black text-white shadow-sm sm:text-[9px]">Shop Weekly Deals →</span>
            </div>
          </Link>
        </section>

        <div className="mt-4 grid gap-4 lg:grid-cols-[230px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="hidden self-start rounded-[22px] border border-[#E5DDD1] bg-white p-4 shadow-[0_8px_26px_rgba(48,38,26,0.055)] lg:block lg:sticky lg:top-4" aria-label="Product filters">
            <div className="flex items-center justify-between border-b border-[#EEE7DD] pb-3">
              <span className="flex items-center gap-2 text-sm font-black"><SlidersHorizontal size={16} /> Filters</span>
              <button type="button" onClick={clearAll} className="text-[9px] font-black text-[#0F6A5F] hover:underline">Clear All</button>
            </div>

            <div className="border-b border-[#EEE7DD] py-4">
              <p className="mb-2.5 text-[10px] font-black">Category</p>
              <div className="space-y-2">
                <button type="button" onClick={() => shop.setCategory('all')} className="flex w-full items-center gap-2 text-left text-[10px] font-semibold">
                  <span className={`flex h-4 w-4 items-center justify-center rounded border ${shop.category === 'all' ? 'border-[#0F6A5F] bg-[#0F6A5F] text-white' : 'border-black/20 bg-white'}`}>{shop.category === 'all' ? '✓' : ''}</span>
                  All Products
                </button>
                {activeCategories.slice(0, 9).map((category) => {
                  const value = categoryValue(category);
                  const selected = shop.category === value;
                  return (
                    <button key={category.id} type="button" onClick={() => shop.setCategory(selected ? 'all' : value)} className="flex w-full items-center gap-2 text-left text-[10px] font-semibold">
                      <span className={`flex h-4 w-4 items-center justify-center rounded border ${selected ? 'border-[#0F6A5F] bg-[#0F6A5F] text-white' : 'border-black/20 bg-white'}`}>{selected ? '✓' : ''}</span>
                      <span className="line-clamp-1">{categoryLabel(category)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-b border-[#EEE7DD] py-4">
              <p className="mb-2.5 text-[10px] font-black">Price Range</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['all', 'Any price'],
                  ['99', 'Under 99'],
                  ['299', 'Under 299'],
                  ['999', 'Under 999'],
                ].map(([value, label]) => (
                  <button key={value} type="button" onClick={() => { shop.setWholesaleOnly(false); shop.setMaxPrice(value); }} className={`rounded-xl px-2 py-2 text-[8px] font-black ${shop.maxPrice === value && !shop.wholesaleOnly ? 'bg-[#0F6A5F] text-white' : 'bg-[#F5F1EA] text-[#3A332A]'}`}>{label}</button>
                ))}
              </div>
            </div>

            <div className="border-b border-[#EEE7DD] py-4">
              <p className="mb-2.5 text-[10px] font-black">Availability</p>
              <button type="button" onClick={() => setStockOnly((value) => !value)} className="flex w-full items-center gap-2 text-left text-[10px] font-semibold">
                <span className={`flex h-4 w-4 items-center justify-center rounded border ${stockOnly ? 'border-[#0F6A5F] bg-[#0F6A5F] text-white' : 'border-black/20 bg-white'}`}>{stockOnly ? '✓' : ''}</span>
                In Stock
              </button>
            </div>

            {colorOptions.length > 0 && (
              <div className="border-b border-[#EEE7DD] py-4">
                <div className="mb-2.5 flex items-center justify-between"><p className="text-[10px] font-black">Color</p>{selectedColor && <button type="button" onClick={() => setSelectedColor('')} className="text-[8px] font-bold text-[#0F6A5F]">Clear</button>}</div>
                <div className="flex flex-wrap gap-1.5">
                  {colorOptions.map((color) => (
                    <button key={color} type="button" onClick={() => setSelectedColor(selectedColor === color ? '' : color)} className={`rounded-full border px-2.5 py-1.5 text-[8px] font-black ${selectedColor === color ? 'border-[#0F6A5F] bg-[#EAF5F1] text-[#0F6A5F]' : 'border-[#E3DBD0] bg-white text-[#4A4238]'}`}>{color}</button>
                  ))}
                </div>
              </div>
            )}

            {materialOptions.length > 0 && (
              <div className="border-b border-[#EEE7DD] py-4">
                <div className="mb-2.5 flex items-center justify-between"><p className="text-[10px] font-black">Material</p>{selectedMaterial && <button type="button" onClick={() => setSelectedMaterial('')} className="text-[8px] font-bold text-[#0F6A5F]">Clear</button>}</div>
                <div className="space-y-2">
                  {materialOptions.map((material) => (
                    <button key={material} type="button" onClick={() => setSelectedMaterial(selectedMaterial === material ? '' : material)} className="flex w-full items-center gap-2 text-left text-[10px] font-semibold">
                      <span className={`flex h-4 w-4 items-center justify-center rounded border ${selectedMaterial === material ? 'border-[#0F6A5F] bg-[#0F6A5F] text-white' : 'border-black/20 bg-white'}`}>{selectedMaterial === material ? '✓' : ''}</span>
                      {material}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4">
              <p className="mb-2.5 text-[10px] font-black">Deal Type</p>
              <div className="space-y-2">
                <button type="button" onClick={() => { shop.setOnlyDeals(false); shop.setWholesaleOnly(false); }} className="flex w-full items-center gap-2 text-left text-[10px] font-semibold"><span className={`flex h-4 w-4 items-center justify-center rounded border ${!shop.onlyDeals && !shop.wholesaleOnly ? 'border-[#0F6A5F] bg-[#0F6A5F] text-white' : 'border-black/20 bg-white'}`}>{!shop.onlyDeals && !shop.wholesaleOnly ? '✓' : ''}</span>Regular</button>
                <button type="button" onClick={() => { shop.setWholesaleOnly(false); shop.setOnlyDeals((value) => !value); }} className="flex w-full items-center gap-2 text-left text-[10px] font-semibold"><span className={`flex h-4 w-4 items-center justify-center rounded border ${shop.onlyDeals ? 'border-[#0F6A5F] bg-[#0F6A5F] text-white' : 'border-black/20 bg-white'}`}>{shop.onlyDeals ? '✓' : ''}</span>Deals</button>
                <button type="button" onClick={() => { shop.setOnlyDeals(false); shop.setWholesaleOnly(!shop.wholesaleOnly); shop.setMaxPrice('all'); }} className="flex w-full items-center gap-2 text-left text-[10px] font-semibold"><span className={`flex h-4 w-4 items-center justify-center rounded border ${shop.wholesaleOnly ? 'border-[#0F6A5F] bg-[#0F6A5F] text-white' : 'border-black/20 bg-white'}`}>{shop.wholesaleOnly ? '✓' : ''}</span>Wholesale</button>
              </div>
            </div>
          </aside>

          <section className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:mb-4">
              <div className="min-w-0">
                <h1 className="truncate text-[23px] font-black tracking-[-0.04em] text-[#252019] sm:text-[28px]">{heading}</h1>
                {searchView && storefrontProducts.length === 0 && <p className="mt-1 text-[10px] font-semibold text-black/45">Try a shorter word, category name, or a similar spelling.</p>}
              </div>

              <div className="flex w-full items-center gap-2 sm:w-auto">
                <button type="button" onClick={() => shop.setFiltersOpen(true)} className="flex h-10 items-center gap-1.5 rounded-xl border border-[#E2D9CC] bg-white px-3 text-[9px] font-black shadow-sm lg:hidden"><SlidersHorizontal size={14} /> Filters</button>
                <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#E2D9CC] bg-white px-3 text-[9px] font-bold shadow-sm sm:flex-none">
                  <span className="hidden text-black/45 sm:inline">Sort by:</span>
                  <select value={sortMode} onChange={(event) => setSortMode(event.target.value)} className="min-w-0 bg-transparent pr-1 text-[9px] font-black outline-none sm:min-w-[120px]">
                    <option value="best-selling">Best Selling</option>
                    <option value="newest">Newest First</option>
                    <option value="price-low">Price: Low to High</option>
                    <option value="price-high">Price: High to Low</option>
                    <option value="discount">Biggest Discount</option>
                  </select>
                </label>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#075C4E] text-white shadow-sm" aria-hidden="true"><Grid2X2 size={16} /></span>
              </div>
            </div>

            <CatalogProductGrid
              products={storefrontProducts}
              addedId={shop.addedId}
              addProduct={shop.addProduct}
              loading={shop.loading}
              dense
            />

            {budgetView && recommendations.length > 0 && (
              <section className="mt-9 border-t border-[#E2D9CC] pt-6">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#0F6A5F]">More products</p>
                <h2 className="mb-3 mt-0.5 text-xl font-black tracking-tight">More to Explore</h2>
                <CatalogProductGrid products={recommendations} addedId={shop.addedId} addProduct={shop.addProduct} loading={shop.loading} dense />
              </section>
            )}
          </section>
        </div>

        <section className="mt-6 grid grid-cols-2 gap-2 rounded-[22px] border border-[#E3DACC] bg-white p-3 shadow-[0_8px_24px_rgba(48,38,26,0.05)] sm:grid-cols-4 sm:p-4" aria-label="Shopping benefits">
          {[
            [Truck, 'Free Delivery', 'On eligible orders'],
            [ShieldCheck, 'Secure Payments', 'Safe checkout'],
            [RotateCcw, 'Easy Returns', 'Hassle-free support'],
            [BadgeCheck, 'Genuine Products', 'PrimeHub quality'],
          ].map(([Icon, title, text]) => {
            const BenefitIcon = Icon as typeof Truck;
            return (
              <div key={String(title)} className="flex items-center gap-2.5 rounded-xl bg-[#FAF7F2] p-2.5 sm:bg-transparent sm:p-1">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFF0D3] text-[#B77B08]"><BenefitIcon size={16} /></span>
                <span><b className="block text-[9px] sm:text-[10px]">{String(title)}</b><span className="mt-0.5 block text-[7px] font-semibold text-black/40 sm:text-[8px]">{String(text)}</span></span>
              </div>
            );
          })}
        </section>
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
