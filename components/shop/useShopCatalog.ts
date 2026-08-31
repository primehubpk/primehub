'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { useSettings } from '@/lib/useSettings';
import { useCartStore } from '@/lib/cartStore';
import { categoryHref, categoryLabel, productMatchesCategory, slugifyCategory } from '@/lib/categoryUtils';
import { isWholesaleProduct } from '@/lib/wholesale';
import { Product, Category, ShopCatalogModel, imageOf, priceOf, originalOf, productHasVariants, titleOf } from './ShopTypes';

export function useShopCatalog(initialCategory?: string, initialQuery = ''): ShopCatalogModel {
  const { settings } = useSettings();
  const addItem = useCartStore((state) => state.addItem);
  const openVariantModal = useCartStore((state) => state.openVariantModal);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory || 'all');
  const [maxPrice, setMaxPrice] = useState('all');
  const [onlyDeals, setOnlyDeals] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [addedId, setAddedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const [wholesaleOnly, setWholesaleOnly] = useState(searchParams.get('wholesale') === 'true');

  useEffect(() => {
    setCategory(initialCategory ? slugifyCategory(decodeURIComponent(initialCategory)) || initialCategory : 'all');
  }, [initialCategory]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [productSnap, categorySnap] = await Promise.all([
          getDocs(collection(db, 'products')),
          getDocs(collection(db, 'categories')),
        ]);
        if (cancelled) return;
        setProducts(productSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Product)));
        setCategories(categorySnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Category)));
      } finally {
        if (!cancelled) {
          setFiltersOpen(false);
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const buckets = useMemo(
    () => [...(settings.priceBuckets || [])].filter((bucket) => bucket.active).sort((a, b) => a.sortOrder - b.sortOrder),
    [settings.priceBuckets],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (p.published === false) return false;
      const title = titleOf(p).toLowerCase();
      const cat = String(p.category || '').toLowerCase();
      const catId = String(p.categoryId || '').toLowerCase();
      const matchesSearch = !q || title.includes(q) || cat.includes(q) || catId.includes(q);
      const selectedCat = wholesaleOnly || productMatchesCategory(category, p, categories);
      const matchesPrice = wholesaleOnly || maxPrice === 'all' || !Number(maxPrice) || priceOf(p) <= Number(maxPrice);
      const matchesDeal = !onlyDeals || Boolean(p.isFlashSale);
      const matchesWholesale = !wholesaleOnly || isWholesaleProduct(p);
      return matchesSearch && selectedCat && matchesPrice && matchesDeal && matchesWholesale;
    });
  }, [products, categories, search, category, maxPrice, onlyDeals, wholesaleOnly]);

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
