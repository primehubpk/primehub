import type { Dispatch, SetStateAction } from 'react';
import { slugifyCategory } from '@/lib/categoryUtils';
import { normalizeImageUrl } from '@/lib/imageUrl';

export type Product = {
  id: string; title?: string; name?: string; price?: number; compareAtPrice?: number; originalPrice?: number;
  imageUrl?: string; image?: string; images?: string[]; category?: string; categoryId?: string;
  isFlashSale?: boolean; stock?: number; quantity?: number; isWholesale?: boolean; [key: string]: any;
};

export type Category = {
  id: string; name?: string; title?: string; slug?: string; iconUrl?: string; imageUrl?: string; image?: string; [key: string]: any;
};

export type FilterState = { search: string; category: string; maxPrice: string; onlyDeals: boolean; filtersOpen: boolean };
export type CategoryRail = { id: string; title: string; href: string; imageUrl?: string; products: Product[] };
export type ShopCatalogActions = {
  setSearch: Dispatch<SetStateAction<string>>; setCategory: Dispatch<SetStateAction<string>>;
  setMaxPrice: Dispatch<SetStateAction<string>>; setOnlyDeals: Dispatch<SetStateAction<boolean>>;
  setFiltersOpen: Dispatch<SetStateAction<boolean>>; setWholesaleOnly: (value: boolean) => void;
  addProduct: (product: Product) => void;
};
export type ShopCatalogModel = FilterState & ShopCatalogActions & {
  products: Product[]; categories: Category[]; filtered: Product[]; rails: CategoryRail[]; buckets: any[];
  addedId: string | null; wholesaleOnly: boolean; categoryLabel: string; loading: boolean;
};

export function titleOf(p: Product) { return p.title || p.name || ''; }

function imageValue(value: unknown) {
  if (typeof value === 'string') return normalizeImageUrl(value);
  if (value && typeof value === 'object') {
    const item = value as { url?: unknown; imageUrl?: unknown };
    const nested = typeof item.url === 'string'
      ? item.url
      : typeof item.imageUrl === 'string'
        ? item.imageUrl
        : '';
    return normalizeImageUrl(nested);
  }
  return '';
}

export function imageCandidatesOf(p: Product) {
  const raw = [
    p.imageUrl,
    p.image,
    ...(Array.isArray(p.images) ? (p.images as unknown[]) : []),
  ];
  const seen = new Set<string>();
  const images: string[] = [];
  for (const value of raw) {
    const image = imageValue(value);
    if (!image || seen.has(image)) continue;
    seen.add(image);
    images.push(image);
  }
  return images;
}

export function imageOf(p: Product) { return imageCandidatesOf(p)[0] || ''; }
export function priceOf(p: Product) { return Number(p.price || 0); }
export function originalOf(p: Product) { return Number(p.compareAtPrice ?? p.originalPrice ?? 0); }
export function slugify(value: string) { return slugifyCategory(value); }
export function discountOf(p: Product) { const price = priceOf(p); const original = originalOf(p); return original > price && price > 0 ? Math.round(((original - price) / original) * 100) : 0; }

export function variantRowsOf(p: Product) {
  return [
    ...(Array.isArray(p.variantMatrix) ? p.variantMatrix : []),
    ...(Array.isArray(p.variants) ? p.variants : []),
  ];
}

export function productHasVariants(p: Product) {
  return variantRowsOf(p).some((row) => {
    if (!row || typeof row !== 'object') return false;
    return row.active !== false && row.hidden !== true;
  });
}

export function availableStockOf(p: Product) {
  const rawParentStock: unknown = p.stock ?? p.quantity;
  const parentStock =
    rawParentStock == null || rawParentStock === ''
      ? 30
      : Math.max(0, Number(rawParentStock) || 0);
  const rows = variantRowsOf(p).filter(
    (row) => row && row.active !== false && row.hidden !== true,
  );

  if (rows.length) {
    return rows.reduce((sum, row) => {
      const raw = row.stock;
      const resolved =
        raw == null || raw === ''
          ? parentStock
          : Math.max(0, Number(raw) || 0);
      return sum + resolved;
    }, 0);
  }

  return parentStock;
}
