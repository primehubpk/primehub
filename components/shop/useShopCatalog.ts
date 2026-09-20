'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSettings } from '@/lib/useSettings';
import { useCartStore } from '@/lib/cartStore';
import { categoryHref, categoryLabel, productMatchesCategory, slugifyCategory } from '@/lib/categoryUtils';
import { smartSearchProducts } from '@/lib/smartSearch';
import { isWholesaleProduct } from '@/lib/wholesale';
import { getEffectivePrice } from '@/lib/dealPricing';
import { matchesSaleMelaBucket } from '@/lib/priceBucketUtils';
import { cacheCatalogForNavigation, readCachedCatalog } from '@/lib/productNavigationCache';
import { makeTikTokContent, trackTikTokEvent } from '@/lib/tiktokPixel';
import { Product, Category, ShopCatalogModel, imageOf, priceOf, originalOf, productHasVariants, titleOf } from './ShopTypes';

export function useShopCatalog(initialCategory?: string, initialQuery = '', initialProducts: Product[] = [], initialCategories: Category[] = []): ShopCatalogModel {
  const { settings } = useSettings();
  const addItem = useCartStore((state) => state.addItem);
  const openVariantModal = useCartStore((state) => state.openVariantModal);
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get('q') || '';
  const bucketParam = searchParams.get('bucket') || '';
  const numericBucket = Number(bucketParam);
  const urlMax = searchParams.get('max') || ([99, 299, 999].includes(numericBucket) ? String(numericBucket) : 'all');
  const hasServerData = initialProducts.length > 0 || initialCategories.length > 0;
  const [products, setProducts] = useState<Product[]>(() => hasServerData ? initialProducts : []);
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
    let cancelled = false;
    const cached = hasServerData ? null : readCachedCatalog<Product, Category>();

    // A navigation cache may paint immediately, but it is never authoritative.
    // Always replace it with a no-store storefront read as soon as this view mounts.
    if (!hasServerData && cached && cached.products.length > 0) {
      setProducts(cached.products);
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

        if (nextProducts.length > 0) setProducts(nextProducts);
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

    if (hasServerData) setLoading(false);
    else void load();

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

  const selectedSaleMelaBucket = useMemo(() => {
    if (maxPrice === 'all') return null;
    const amount = Number(maxPrice);
    return [99, 299, 999].includes(amount) ? amount : null;
  }, [maxPrice]);

  const filtered = useMemo(() => {
    const searchable = smartSearchProducts(products.filter((p) => p.published !== false), search);
    return searchable.filter((p) => {
      const selectedCat = wholesaleOnly || productMatchesCategory(category, p, categories);
      const effectivePrice = selectedSaleMelaBucket
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
        (selectedSaleMelaBucket
          ? matchesSaleMelaBucket(effectivePrice, selectedSaleMelaBucket)
          : effectivePrice <= Number(maxPrice));
      const matchesDeal = !onlyDeals || Boolean(p.isFlashSale);
      const matchesWholesale = wholesaleOnly
        ? isWholesaleProduct(p)
        : !isWholesaleProduct(p);
      return selectedCat && matchesPrice && matchesDeal && matchesWholesale;
    });
  }, [products, categories, search, category, maxPrice, onlyDeals, wholesaleOnly, selectedSaleMelaBucket]);

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

  const addProduct = async (product: Product) => {
    let currentProduct = product;

    try {
      const response = await fetch(
        `/api/storefront/read?type=product&id=${encodeURIComponent(product.id)}`,
        { cache: 'no-store' },
      );
      if (response.ok) {
        const data = await response.json();
        if (data?.product && String(data.product.id || '') === String(product.id)) {
          currentProduct = data.product as Product;
          setProducts((current) => current.map((item) => item.id === currentProduct.id ? currentProduct : item));
        }
      }
    } catch (error) {
      console.warn('fresh product read unavailable; using current catalog product', error);
    }

    const image = imageOf(currentProduct) || imageOf(product);
    if (productHasVariants(currentProduct) && openVariantModal({ ...currentProduct, image, imageUrl: image }, 'cart')) return;
    const currentPrice = priceOf(currentProduct);
    addItem({
      id: currentProduct.id,
      productId: currentProduct.id,
      category: String(currentProduct.category || ''),
      name: titleOf(currentProduct),
      price: currentPrice,
      originalPrice: originalOf(currentProduct) || currentPrice,
      image,
      imageUrl: image,
    });
    trackTikTokEvent('AddToCart', {
      contents: [
        makeTikTokContent({
          id: currentProduct.id,
          name: titleOf(currentProduct),
          category: currentProduct.category,
          price: currentPrice,
          quantity: 1,
        }),
      ],
      value: currentPrice,
      currency: 'PKR',
    });
    setAddedId(currentProduct.id);
    window.setTimeout(() => setAddedId((current) => (current === currentProduct.id ? null : current)), 1400);
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
