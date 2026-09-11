'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSettings } from '@/lib/useSettings';
import { useCartStore } from '@/lib/cartStore';
import { categoryHref, categoryLabel, productMatchesCategory, slugifyCategory } from '@/lib/categoryUtils';
import { smartSearchProducts } from '@/lib/smartSearch';
import { isWholesaleProduct } from '@/lib/wholesale';
import { shuffleProducts } from '@/lib/shuffleProducts';
import { getEffectivePrice } from '@/lib/dealPricing';
import { priceBucketRange, saleMelaPriceRange } from '@/lib/priceBucketUtils';
import { cacheCatalogForNavigation, readCachedCatalog } from '@/lib/productNavigationCache';
import { Product, Category, ShopCatalogModel, imageOf, priceOf, originalOf, productHasVariants, titleOf } from './ShopTypes';

const NAVIGATION_CACHE_FRESH_MS = 45_000;

export function useShopCatalog(initialCategory?: string, initialQuery = '', initialProducts: Product[] = [], initialCategories: Category[] = []): ShopCatalogModel {
  const { settings } = useSettings();
  const addItem = useCartStore((state) => state.addItem);
  const openVariantModal = useCartStore((state) => state.openVariantModal);
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get('q') || '';
  const bucketParam = searchParams.get('bucket') || '';
  const numericBucket = Number(bucketParam);
  const saleMelaView = searchParams.get('sale') === '1';
  const urlMax = searchParams.get('max') || (saleMelaView && [99, 299, 999].includes(numericBucket) ? String(numericBucket) : 'all');
  const hasServerData = initialProducts.length > 0 || initialCategories.length > 0;
  const [products, setProducts] = useState<Product[]>(() => hasServerData ? shuffleProducts(initialProducts) : []);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [search, setSearch] = useState(initialQuery || urlQuery);
  const [category, setCategory] = useState(initialCategory || 'all');
  const [maxPrice, setMaxPrice] = useState(urlMax);
  const [onlyDeals, setOnlyDeals] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [addedId, setAddedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(!hasServerData);
  const [wholesaleOnly, setWholesaleOnly] = useState(['true', '1'].includes(searchParams.get('wholesale') || ''));

  useEffect(() => {
    setCategory(initialCategory ? slugifyCategory(decodeURIComponent(initialCategory)) || initialCategory : 'all');
  }, [initialCategory]);

  useEffect(() => {
    if (!initialQuery) setSearch(urlQuery);
    setMaxPrice(urlMax);
  }, [initialQuery, urlQuery, urlMax]);

  useEffect(() => {
    if (hasServerData) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const cached = readCachedCatalog<Product, Category>();
    const hasWarmCatalog = Boolean(cached && cached.products.length > 0);
    const cacheAge = cached ? Date.now() - cached.updatedAt : Number.POSITIVE_INFINITY;
    const cacheIsFresh = hasWarmCatalog && cacheAge <= NAVIGATION_CACHE_FRESH_MS;

    if (cached && cached.products.length > 0) {
      setProducts(shuffleProducts(cached.products));
      if (cached.categories.length > 0) setCategories(cached.categories);
      setLoading(false);
    }

    async function load() {
      try {
        const response = await fetch('/api/storefront/read?type=catalog', { cache: 'no-store' });
        if (!response.ok) throw new Error(`catalog read ${response.status}`);
        const data = await response.json();
        if (cancelled) return;

        const nextProducts = (Array.isArray(data?.products) ? data.products : []) as Product[];
        const nextCategories = (Array.isArray(data?.categories) ? data.categories : []) as Category[];

        if (nextProducts.length > 0) setProducts(shuffleProducts(nextProducts));
        if (nextCategories.length > 0) setCategories(nextCategories);
      } catch (error) {
        console.warn('shop dual catalog read unavailable', error);
      } finally {
        if (!cancelled) {
          setFiltersOpen(false);
          setLoading(false);
        }
      }
    }

    if (!cacheIsFresh) {
      void load();
    } else {
      setFiltersOpen(false);
    }

    return () => {
      cancelled = true;
    };
  }, [hasServerData]);

  useEffect(() => {
    cacheCatalogForNavigation(products, categories);
  }, [products, categories]);

  const buckets = useMemo(
    () => [...(settings.priceBuckets || [])].filter((bucket) => bucket.active).sort((a, b) => a.sortOrder - b.sortOrder),
    [settings.priceBuckets],
  );

  const selectedSaleRange = useMemo(() => {
    if (!saleMelaView || maxPrice === 'all') return null;
    return saleMelaPriceRange(Number(maxPrice));
  }, [saleMelaView, maxPrice]);

  const selectedBudgetRange = useMemo(() => {
    if (saleMelaView || maxPrice === 'all') return null;
    const amount = Number(maxPrice);
    if (!amount) return null;

    const isKnownBucket = [99, 299, 999].includes(amount);
    return isKnownBucket ? priceBucketRange(buckets, amount) : null;
  }, [buckets, maxPrice, saleMelaView]);

  const filtered = useMemo(() => {
    const searchable = smartSearchProducts(products.filter((p) => p.published !== false), search);
    return searchable.filter((p) => {
      const selectedCat = wholesaleOnly || productMatchesCategory(category, p, categories);
      const useEffectivePrice = Boolean(selectedBudgetRange || selectedSaleRange);
      const effectivePrice = useEffectivePrice
        ? getEffectivePrice({
            price: Number(p.normalPrice || p.price || 0),
            dealPrice: Number(p.dealPrice || 0),
            dealDay: String(p.dealDay || ''),
          })
        : priceOf(p);
      const matchesPrice =
        wholesaleOnly ||
        maxPrice === 'all' ||
        !Number(maxPrice) ||
        (selectedSaleRange
          ? effectivePrice >= selectedSaleRange.minInclusive &&
            (selectedSaleRange.maxExclusive === null || effectivePrice < selectedSaleRange.maxExclusive)
          : selectedBudgetRange
            ? effectivePrice > selectedBudgetRange.minExclusive &&
              effectivePrice <= selectedBudgetRange.maxInclusive
            : effectivePrice <= Number(maxPrice));
      const matchesDeal = !onlyDeals || Boolean(p.isFlashSale);
      const matchesWholesale = wholesaleOnly
        ? isWholesaleProduct(p)
        : selectedSaleRange || selectedBudgetRange
          ? !isWholesaleProduct(p)
          : true;
      return selectedCat && matchesPrice && matchesDeal && matchesWholesale;
    });
  }, [products, categories, search, category, maxPrice, onlyDeals, wholesaleOnly, selectedBudgetRange, selectedSaleRange]);

  const rails = useMemo(() => {
    const used = new Set<string>();
    const ordered = [...categories]
      .filter((item) => item.active !== false)
      .sort((a, b) => Number(a.sortOrder ?? 999) - Number(b.sortOrder ?? 999));

    const grouped = ordered.map((item) => {
      const title = item.title || item.name || item.id;
      const items = filtered.filter((product) => productMatchesCategory(slugifyCategory(item.slug || title), product, [item]));
      items.forEach((product) => used.add(product.id));
      return {
        id: item.id,
        title,
        href: categoryHref(item),
        imageUrl: item.iconUrl || item.imageUrl || item.image || imageOf(items[0]),
        products: items,
      };
    }).filter((rail) => rail.products.length > 0);

    const leftovers = new Map<string, Product[]>();
    filtered.forEach((product) => {
      if (used.has(product.id)) return;
      const title = String(product.category || 'More to explore').trim() || 'More to explore';
      const list = leftovers.get(title) || [];
      list.push(product);
      leftovers.set(title, list);
    });

    leftovers.forEach((items, title) => {
      grouped.push({ id: slugifyCategory(title) || title, title, href: categoryHref(title), imageUrl: imageOf(items[0]), products: items });
    });

    return grouped;
  }, [filtered, categories]);

  const resolvedCategoryLabel = useMemo(() => categoryLabel(category, categories), [category, categories]);

  const addProduct = (product: Product) => {
    const image = imageOf(product);
    if (productHasVariants(product) && openVariantModal({ ...product, image, imageUrl: image }, 'cart')) return;
    addItem({
      id: product.id,
      name: titleOf(product),
      price: priceOf(product),
      originalPrice: originalOf(product) || priceOf(product),
      image,
      imageUrl: image,
    });
    setAddedId(product.id);
    window.setTimeout(() => setAddedId((current) => (current === product.id ? null : current)), 1400);
  };

  return {
    products,
    categories,
    search,
    category,
    maxPrice,
    onlyDeals,
    filtersOpen,
    addedId,
    wholesaleOnly,
    buckets,
    filtered,
    rails,
    categoryLabel: resolvedCategoryLabel,
    loading,
    setSearch,
    setCategory,
    setMaxPrice,
    setOnlyDeals,
    setFiltersOpen,
    setWholesaleOnly,
    addProduct,
  };
}
