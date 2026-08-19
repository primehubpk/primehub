'use client';

import { useShopCatalog } from './shop/useShopCatalog';
import CatalogHeader from './shop/CatalogHeader';
import BudgetBuckets from './shop/BudgetBuckets';
import CategoryFilter from './shop/CategoryFilter';
import CatalogFilters, { FilterDrawer } from './shop/CatalogFilters';
import CatalogProductGrid from './shop/CatalogProductGrid';

export default function ShopCatalog({ initialCategory, initialQuery = '' }: { initialCategory?: string; initialQuery?: string }) {
  const shop = useShopCatalog(initialCategory, initialQuery);
  const clearAll = () => { shop.setSearch(''); shop.setCategory('all'); shop.setMaxPrice('all'); shop.setOnlyDeals(false); shop.setFiltersOpen(false); };
  return <main className="min-h-screen bg-[#F4F4F1] pb-28"><div className="mx-auto max-w-6xl px-4 py-5 md:px-6"><CatalogHeader search={shop.search} count={shop.filtered.length} setSearch={shop.setSearch} /><BudgetBuckets buckets={shop.buckets} maxPrice={shop.maxPrice} setMaxPrice={shop.setMaxPrice} /><CategoryFilter categories={shop.categories} category={shop.category} setCategory={shop.setCategory} /><CatalogFilters setFiltersOpen={shop.setFiltersOpen} onlyDeals={shop.onlyDeals} setOnlyDeals={shop.setOnlyDeals} /><section className="mt-4"><CatalogProductGrid products={shop.filtered} addedId={shop.addedId} addProduct={shop.addProduct} /></section></div><FilterDrawer filtersOpen={shop.filtersOpen} setFiltersOpen={shop.setFiltersOpen} maxPrice={shop.maxPrice} setMaxPrice={shop.setMaxPrice} onlyDeals={shop.onlyDeals} setOnlyDeals={shop.setOnlyDeals} clearAll={clearAll} /></main>;
}
