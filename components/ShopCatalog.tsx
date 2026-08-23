'use client';

import { useShopCatalog } from './shop/useShopCatalog';
import CatalogHeader from './shop/CatalogHeader';
import BudgetBuckets from './shop/BudgetBuckets';
import CategoryFilter from './shop/CategoryFilter';
import { FilterDrawer } from './shop/CatalogFilters';
import CatalogProductGrid from './shop/CatalogProductGrid';
import CategoryRails from './shop/CategoryRails';

export default function ShopCatalog({
  initialCategory,
  initialQuery = '',
}: {
  initialCategory?: string;
  initialQuery?: string;
}) {
  const shop = useShopCatalog(initialCategory, initialQuery);
  const isCategoryView = Boolean(initialCategory);
  const clearAll = () => {
    shop.setSearch('');
    shop.setCategory(initialCategory || 'all');
    shop.setMaxPrice('all');
    shop.setOnlyDeals(false);
    shop.setWholesaleOnly(false);
    shop.setFiltersOpen(false);
  };

  return (
    <main className="min-h-screen bg-[#F4F4F1] pb-28">
      <div className="mx-auto max-w-6xl px-4 py-5 md:px-6">
        <CatalogHeader
          search={shop.search}
          count={shop.filtered.length}
          setSearch={shop.setSearch}
          title={isCategoryView ? shop.categoryLabel : undefined}
          setFiltersOpen={shop.setFiltersOpen}
          onlyDeals={shop.onlyDeals}
          setOnlyDeals={shop.setOnlyDeals}
        />
        <BudgetBuckets
          buckets={shop.buckets}
          maxPrice={shop.maxPrice}
          setMaxPrice={shop.setMaxPrice}
          wholesaleOnly={shop.wholesaleOnly}
          setWholesaleOnly={shop.setWholesaleOnly}
        />
        {isCategoryView ? <CategoryFilter categories={shop.categories} category={shop.category} setCategory={shop.setCategory} /> : null}
        {isCategoryView ? (
          <section className="mt-6">
            <CatalogProductGrid products={shop.filtered} addedId={shop.addedId} addProduct={shop.addProduct} loading={shop.loading} />
          </section>
        ) : (
          <>
            <CategoryRails rails={shop.rails} addedId={shop.addedId} addProduct={shop.addProduct} loading={shop.loading} />
            <section className="mt-10">
              <div className="mb-4">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#E1352B]">All Products</p>
                <h2 className="mt-0.5 text-xl font-black tracking-tight text-[#14140F]">🔥 Just For You</h2>
              </div>
              <CatalogProductGrid products={shop.filtered} addedId={shop.addedId} addProduct={shop.addProduct} loading={shop.loading} />
            </section>
          </>
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
