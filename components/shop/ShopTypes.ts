import type { Dispatch, SetStateAction } from 'react';
import { slugifyCategory } from '@/lib/categoryUtils';

export type Product = {
  id: string; title?: string; name?: string; price?: number; compareAtPrice?: number; originalPrice?: number;
  imageUrl?: string; image?: string; images?: string[]; category?: string; categoryId?: string;
  isFlashSale?: boolean; stock?: number; quantity?: number; isWholesale?: boolean; [key: string]: any;
};

export type Category = {
  id: string; name?: string; title?: string; slug?: string; iconUrl?: string; imageUrl?: string; image?: string; [key: string]: any;
};

export type FilterState = { search: string; category: string; maxPrice: string; onlyDeals: boolean; filtersOpen: boolean };
export type ShopCatalogActions = {
  setSearch: Dispatch<SetStateAction<string>>; setCategory: Dispatch<SetStateAction<string>>;
  setMaxPrice: Dispatch<SetStateAction<string>>; setOnlyDeals: Dispatch<SetStateAction<boolean>>;
  setFiltersOpen: Dispatch<SetStateAction<boolean>>; addProduct: (product: Product) => void;
};
export type ShopCatalogModel = FilterState & ShopCatalogActions & {
  products: Product[]; categories: Category[]; filtered: Product[]; buckets: any[];
  addedId: string | null; wholesaleOnly: boolean; categoryLabel: string; loading: boolean;
};

export function titleOf(p: Product) { return p.title || p.name || ''; }
export function imageOf(p: Product) { return p.imageUrl || p.image || p.images?.[0] || ''; }
export function priceOf(p: Product) { return Number(p.price || 0); }
export function originalOf(p: Product) { return Number(p.compareAtPrice ?? p.originalPrice ?? 0); }
export function slugify(value: string) { return slugifyCategory(value); }
export function discountOf(p: Product) { const price = priceOf(p); const original = originalOf(p); return original > price && price > 0 ? Math.round(((original - price) / original) * 100) : 0; }
