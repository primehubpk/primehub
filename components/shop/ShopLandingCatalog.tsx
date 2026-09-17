'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  Boxes,
  Flame,
  Grid2X2,
  SlidersHorizontal,
  Star,
  Tag,
  Zap,
} from 'lucide-react';
import HomeHeader from '@/components/home/HomeHeader';
import '@/components/home/home.css';
import './shop.css';
import { useShopCatalog } from './useShopCatalog';
import { FilterDrawer, ShopFilterPanel } from './CatalogFilters';
import CatalogProductGrid from './CatalogProductGrid';
import FastProductLink from '@/components/FastProductLink';
import { newestFirst } from '@/components/NewArrivalsRail';
import { getEffectivePrice } from '@/lib/dealPricing';
import { isWholesaleProduct } from '@/lib/wholesale';
import { matchesSaleMelaBucket } from '@/lib/priceBucketUtils';
import {
  discountOf,
  imageOf,
  titleOf,
  type Product,
  type Category,
} from './ShopTypes';

type Props = {
  initialProducts?: Product[];
  initialCategories?: Category[];
};

type QuickView = 'all' | 'best' | 'new' | '99' | '299' | '999' | 'wholesale';
type SaleMelaView = '99' | '299' | '999' | 'wholesale';
type SortMode = 'featured' | 'newest' | 'price-low' | 'price-high';

const NEXT_SALE_MELA_VIEW: Partial<Record<SaleMelaView, SaleMelaView>> = {
  '99': '299',
  '299': '999',
};

function saleMelaLabel(view: SaleMelaView) {
  if (view === '99') return 'Rs. 1 – 298';
  if (view === '299') return 'Rs. 299 – 998';
  if (view === '999') return 'Rs. 999 & Above';
  return 'Wholesale Deals';
}

function score(id: string) {
  return Array.from(id).reduce(
    (value, character) => ((value * 31 + character.charCodeAt(0)) >>> 0),
    7,
  );
}

function bestSellerScore(product: Product) {
  return (
    Number(product.soldCount || product.salesCount || product.orders || 0) * 20 +
    Number(product.rating || 0) * 10 +
    (product.isBestSeller || product.bestseller ? 1000 : 0) +
    discountOf(product)
  );
}

function salePrice(product: Product) {
  return getEffectivePrice({
    price: Number(product.normalPrice || product.price || 0),
    dealPrice: Number(product.dealPrice || 0),
    dealDay: String(product.dealDay || ''),
  });
}

function initialQuickView(bucket: string, wholesale: string): QuickView {
  if (bucket === '99' || bucket === '299' || bucket === '999') return bucket;
  if (bucket === 'wholesale' || wholesale === 'true' || wholesale === '1') return 'wholesale';
  return 'all';
}

export default function ShopLandingCatalog({
  initialProducts = [],
  initialCategories = [],
}: Props) {
  const searchParams = useSearchParams();
  const shop = useShopCatalog(undefined, '', initialProducts, initialCategories);
  const [quickView, setQuickView] = useState<QuickView>(() =>
    initialQuickView(searchParams.get('bucket') || '', searchParams.get('wholesale') || ''),
  );
  const [sortMode, setSortMode] = useState<SortMode>('featured');

  const searchView = Boolean(shop.search.trim());
  const publishedProducts = useMemo(
    () => shop.products.filter((product) => product.published !== false),
    [shop.products],
  );
  const retailProducts = useMemo(
    () => publishedProducts.filter((product) => !isWholesaleProduct(product)),
    [publishedProducts],
  );

  const dealProducts = useMemo(
    () =>
      retailProducts
        .filter(
          (product) =>
            (product.isFlashSale || discountOf(product) > 0) && imageOf(product),
        )
        .sort(
          (a, b) =>
            Number(Boolean(b.isFlashSale)) - Number(Boolean(a.isFlashSale)) ||
            discountOf(b) - discountOf(a),
        )
        .slice(0, 3),
    [retailProducts],
  );

  const quickProducts = useMemo(() => {
    if (searchView) return [...shop.filtered];

    if (quickView === 'new') return newestFirst(retailProducts);
    if (quickView === 'best') {
      return [...retailProducts].sort(
        (a, b) => bestSellerScore(b) - bestSellerScore(a) || score(a.id) - score(b.id),
      );
    }
    if (quickView === 'wholesale') {
      return publishedProducts
        .filter(isWholesaleProduct)
        .sort((a, b) => salePrice(a) - salePrice(b) || score(a.id) - score(b.id));
    }
    if (quickView === '99' || quickView === '299' || quickView === '999') {
      const amount = Number(quickView);
      return retailProducts
        .filter((product) => matchesSaleMelaBucket(salePrice(product), amount))
        .sort((a, b) => salePrice(a) - salePrice(b) || score(a.id) - score(b.id));
    }

    return [...shop.filtered].sort((a, b) => score(a.id) - score(b.id));
  }, [publishedProducts, quickView, retailProducts, searchView, shop.filtered]);

  const sortedProducts = useMemo(() => {
    const products = [...quickProducts];
    if (sortMode === 'newest') return newestFirst(products);
    if (sortMode === 'price-low') {
      return products.sort((a, b) => salePrice(a) - salePrice(b));
    }
    if (sortMode === 'price-high') {
      return products.sort((a, b) => salePrice(b) - salePrice(a));
    }
    return products;
  }, [quickProducts, sortMode]);

  const newArrivalLead = quickView === 'new' && !searchView
    ? sortedProducts.slice(0, 12)
    : sortedProducts;
  const newArrivalMore = quickView === 'new' && !searchView
    ? sortedProducts.slice(12)
    : [];

  const activeSaleMelaView = useMemo<SaleMelaView | null>(() => {
    if (searchView) return null;
    if (quickView === '99' || quickView === '299' || quickView === '999' || quickView === 'wholesale') {
      return quickView;
    }
    if (quickView !== 'all' || shop.category !== 'all') return null;
    if (shop.wholesaleOnly) return 'wholesale';
    if (shop.maxPrice === '99' || shop.maxPrice === '299' || shop.maxPrice === '999') {
      return shop.maxPrice;
    }
    return null;
  }, [quickView, searchView, shop.category, shop.maxPrice, shop.wholesaleOnly]);

  const nextSaleMelaCollection = useMemo(() => {
    if (!activeSaleMelaView) return null;
    const nextView = NEXT_SALE_MELA_VIEW[activeSaleMelaView];
    if (!nextView) return null;

    const products = retailProducts
      .filter((product) => matchesSaleMelaBucket(salePrice(product), Number(nextView)))
      .sort((a, b) => salePrice(a) - salePrice(b) || score(a.id) - score(b.id));

    return {
      view: nextView,
      heading: saleMelaLabel(nextView),
      products,
    };
  }, [activeSaleMelaView, retailProducts]);

  const resetShopFilters = () => {
    shop.setSearch('');
    shop.setCategory('all');
    shop.setMaxPrice('all');
    shop.setOnlyDeals(false);
    shop.setWholesaleOnly(false);
    shop.setFiltersOpen(false);
    setSortMode('featured');
  };

  const selectQuickView = (view: QuickView) => {
    resetShopFilters();
    setQuickView(view);
  };

  const clearAll = () => {
    resetShopFilters();
    setQuickView('all');
  };

  const setCategory = (value: string) => {
    setQuickView('all');
    shop.setCategory(value);
  };
  const setMaxPrice = (value: string) => {
    setQuickView('all');
    shop.setMaxPrice(value);
  };
  const setOnlyDeals = (value: boolean | ((current: boolean) => boolean)) => {
    setQuickView('all');
    shop.setOnlyDeals(
      typeof value === 'function' ? value(shop.onlyDeals) : value,
    );
  };
  const setWholesaleOnly = (value: boolean) => {
    setQuickView('all');
    shop.setWholesaleOnly(value);
  };

  const heading = searchView
    ? `${shop.filtered.length} result${shop.filtered.length === 1 ? '' : 's'} for “${shop.search.trim()}”`
    : quickView === 'new'
      ? 'New Arrivals'
      : quickView === 'best'
        ? 'Best Sellers'
        : activeSaleMelaView
          ? saleMelaLabel(activeSaleMelaView)
          : 'All Products';

  const eyebrow = searchView
    ? 'Smart search'
    : quickView === 'new'
      ? 'Latest products first'
      : quickView === 'best'
        ? 'Customer favourites'
        : activeSaleMelaView
          ? 'PrimeHubMall Sale Mela'
          : 'Picked for you';

  const activeCount = searchView ? shop.filtered.length : quickProducts.length;

  return (
    <main className="shop-storefront min-h-screen pb-28">
      <HomeHeader />
      <div className="shop-page-shell">
        <nav className="shop-quick-filters" aria-label="Featured product filters">
          <button
            type="button"
            className={!searchView && quickView === 'all' ? 'is-active' : ''}
            onClick={() => selectQuickView('all')}
          >
            <Grid2X2 /> All Products
          </button>
          <button
            type="button"
            className={!searchView && quickView === 'best' ? 'is-active' : ''}
            onClick={() => selectQuickView('best')}
          >
            <Flame /> Best Sellers
          </button>
          <button
            type="button"
            className={!searchView && quickView === 'new' ? 'is-active' : ''}
            onClick={() => selectQuickView('new')}
          >
            <Star /> New Arrivals
          </button>
          <button
            type="button"
            className={!searchView && quickView === '99' ? 'is-active' : ''}
            onClick={() => selectQuickView('99')}
          >
            <Tag /> Rs. 1 – 298
          </button>
          <button
            type="button"
            className={!searchView && quickView === '299' ? 'is-active' : ''}
            onClick={() => selectQuickView('299')}
          >
            <Tag /> Rs. 299 – 998
          </button>
          <button
            type="button"
            className={!searchView && quickView === '999' ? 'is-active' : ''}
            onClick={() => selectQuickView('999')}
          >
            <Tag /> Rs. 999 &amp; Above
          </button>
          <button
            type="button"
            className={!searchView && quickView === 'wholesale' ? 'is-active' : ''}
            onClick={() => selectQuickView('wholesale')}
          >
            <Boxes /> Wholesale Deals
          </button>
        </nav>

        <section className="shop-deal-banner" aria-label="Today's deals">
          <div className="shop-deal-copy">
            <Zap aria-hidden="true" />
            <div>
              <h1>Today&apos;s Deals</h1>
              <p>Premium products at special prices</p>
            </div>
          </div>
          {dealProducts.length > 0 && (
            <div className="shop-deal-products" aria-label="Deal product previews">
              {dealProducts.map((product) => (
                <FastProductLink
                  key={product.id}
                  product={product}
                  aria-label={`View ${titleOf(product)}`}
                >
                  <Image
                    src={imageOf(product)}
                    alt={titleOf(product)}
                    fill
                    sizes="110px"
                  />
                </FastProductLink>
              ))}
            </div>
          )}
          <Link href="/weekly-deals" prefetch className="shop-deal-link">
            View All Deals <ArrowRight />
          </Link>
        </section>

        <div className="shop-catalog-layout">
          <aside className="shop-desktop-filters" aria-label="Product filters">
            <ShopFilterPanel
              categories={shop.categories}
              category={shop.category}
              setCategory={setCategory}
              maxPrice={shop.maxPrice}
              setMaxPrice={setMaxPrice}
              onlyDeals={shop.onlyDeals}
              setOnlyDeals={setOnlyDeals}
              wholesaleOnly={shop.wholesaleOnly}
              setWholesaleOnly={setWholesaleOnly}
              clearAll={clearAll}
              productCount={activeCount}
            />
          </aside>

          <section className="shop-results">
            <div className="shop-results-toolbar">
              <div>
                <p>{eyebrow}</p>
                <h2>
                  {heading} <span>— {activeCount} products</span>
                </h2>
              </div>
              <div className="shop-toolbar-actions">
                <button
                  type="button"
                  className="shop-mobile-filter"
                  onClick={() => shop.setFiltersOpen(true)}
                >
                  <SlidersHorizontal /> Shop By
                </button>
                <label>
                  Sort by:
                  <select
                    value={sortMode}
                    onChange={(event) => setSortMode(event.target.value as SortMode)}
                  >
                    <option value="featured">Best Selling</option>
                    <option value="newest">Newest</option>
                    <option value="price-low">Price: Low to High</option>
                    <option value="price-high">Price: High to Low</option>
                  </select>
                </label>
              </div>
            </div>

            {searchView && activeCount === 0 && (
              <p className="shop-empty-tip">
                Try a shorter word, category name, or a similar spelling.
              </p>
            )}

            <CatalogProductGrid
              products={newArrivalLead}
              addedId={shop.addedId}
              addProduct={shop.addProduct}
              loading={shop.loading}
              dense
            />

            {newArrivalMore.length > 0 && (
              <section className="mt-10 border-t border-black/5 pt-7">
                <div className="mb-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#0F6A5F]">
                    More to explore
                  </p>
                  <h2 className="mt-0.5 text-xl font-black tracking-tight">All Products</h2>
                </div>
                <CatalogProductGrid
                  products={newArrivalMore}
                  addedId={shop.addedId}
                  addProduct={shop.addProduct}
                  loading={shop.loading}
                  dense
                />
              </section>
            )}

            {nextSaleMelaCollection && nextSaleMelaCollection.products.length > 0 && (
              <section className="mt-10 border-t border-black/5 pt-7">
                <div className="mb-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#0F6A5F]">
                    PrimeHubMall Sale Mela
                  </p>
                  <h2 className="mt-0.5 text-xl font-black tracking-tight">
                    {nextSaleMelaCollection.heading}
                  </h2>
                </div>
                <CatalogProductGrid
                  products={nextSaleMelaCollection.products}
                  addedId={shop.addedId}
                  addProduct={shop.addProduct}
                  loading={shop.loading}
                  dense
                />
              </section>
            )}
          </section>
        </div>
      </div>

      <FilterDrawer
        filtersOpen={shop.filtersOpen}
        setFiltersOpen={shop.setFiltersOpen}
        categories={shop.categories}
        category={shop.category}
        setCategory={setCategory}
        maxPrice={shop.maxPrice}
        setMaxPrice={setMaxPrice}
        onlyDeals={shop.onlyDeals}
        setOnlyDeals={setOnlyDeals}
        wholesaleOnly={shop.wholesaleOnly}
        setWholesaleOnly={setWholesaleOnly}
        clearAll={clearAll}
        productCount={activeCount}
      />
    </main>
  );
}
