'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { useSettings } from '@/lib/useSettings';
import { useCartStore } from '@/lib/cartStore';
import { Product, Category, ShopCatalogModel, imageOf, priceOf, originalOf, slugify, titleOf } from './ShopTypes';

export function useShopCatalog(initialCategory?: string, initialQuery = ''): ShopCatalogModel {
  const { settings } = useSettings(); const addItem = useCartStore((state) => state.addItem);
  const [products, setProducts] = useState<Product[]>([]); const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState(initialQuery); const [category, setCategory] = useState(initialCategory || 'all'); const [maxPrice, setMaxPrice] = useState('all'); const [onlyDeals, setOnlyDeals] = useState(false); const [filtersOpen, setFiltersOpen] = useState(false); const [addedId, setAddedId] = useState<string | null>(null);
  const searchParams = useSearchParams(); const wholesaleOnly = searchParams.get('wholesale') === 'true';
  useEffect(() => { let cancelled = false; async function load() { try { const [productSnap, categorySnap] = await Promise.all([getDocs(collection(db, 'products')), getDocs(collection(db, 'categories'))]); if (cancelled) return; setProducts(productSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Product))); setCategories(categorySnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Category))); } finally { if (!cancelled) setFiltersOpen(false); } } load(); return () => { cancelled = true; }; }, []);
  const buckets = useMemo(() => [...(settings.priceBuckets || [])].filter((bucket) => bucket.active).sort((a, b) => a.sortOrder - b.sortOrder), [settings.priceBuckets]);
  const filtered = useMemo(() => { const q = search.trim().toLowerCase(); return products.filter((p) => { const title = titleOf(p).toLowerCase(); const cat = String(p.category || '').toLowerCase(); const catId = String(p.categoryId || '').toLowerCase(); const matchesSearch = !q || title.includes(q) || cat.includes(q) || catId.includes(q); const selectedCat = category === 'all' || cat === category.toLowerCase() || catId === category.toLowerCase() || slugify(cat) === category.toLowerCase(); const matchesPrice = maxPrice === 'all' || priceOf(p) <= Number(maxPrice); const matchesDeal = !onlyDeals || Boolean(p.isFlashSale); const matchesWholesale = !wholesaleOnly || Boolean(p.isWholesale); return matchesSearch && selectedCat && matchesPrice && matchesDeal && matchesWholesale; }); }, [products, search, category, maxPrice, onlyDeals, wholesaleOnly]);
  const addProduct = (product: Product) => { const image = imageOf(product); addItem({ id: product.id, name: titleOf(product), price: priceOf(product), originalPrice: originalOf(product) || priceOf(product), image, imageUrl: image }); setAddedId(product.id); window.setTimeout(() => setAddedId((current) => current === product.id ? null : current), 1400); };
  return { products, categories, search, category, maxPrice, onlyDeals, filtersOpen, addedId, wholesaleOnly, buckets, filtered, setSearch, setCategory, setMaxPrice, setOnlyDeals, setFiltersOpen, addProduct };
}
