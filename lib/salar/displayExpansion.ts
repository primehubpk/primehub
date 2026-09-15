import 'server-only';

import { getSalarState } from '@/lib/salar/server';
import { normalizeSearchText, productSearchScore } from '@/lib/smartSearch';

type ProductCard = {
  id: string;
  title: string;
  path: string;
  imageUrl?: string;
  price?: number;
  originalPrice?: number;
  stock?: number;
  category?: string;
};

type CategoryCard = { id: string; title: string; slug?: string; imageUrl?: string };
type DisplayMode = 'none' | 'products' | 'categories' | 'product_images';

type SalarResult = {
  displayMode?: DisplayMode;
  products?: ProductCard[];
  categories?: CategoryCard[];
  context?: { lastProductQuery?: string; shownProductIds?: string[] };
  [key: string]: unknown;
};

function text(value: unknown, max = 500) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function numberValue(value: unknown) {
  if (value === '' || value == null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function imageUrl(product: any) {
  const values = [
    ...(Array.isArray(product?.images) ? product.images.slice(0, 4) : []),
    product?.imageUrl,
    product?.image,
  ];
  for (const value of values) {
    const raw = typeof value === 'string' ? value : value?.url;
    const url = text(raw, 1400);
    if (!url) continue;
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:') return parsed.toString();
    } catch {}
  }
  return '';
}

function productCard(product: any): ProductCard {
  const id = text(product?.id, 200);
  return Object.fromEntries(Object.entries({
    id,
    title: text(product?.title || product?.name, 300),
    path: text(product?.path, 500) || (id ? `/product/${encodeURIComponent(id)}` : ''),
    imageUrl: imageUrl(product) || undefined,
    price: numberValue(product?.price),
    originalPrice: numberValue(product?.originalPrice),
    stock: numberValue(product?.stock ?? product?.quantity),
    category: text(product?.category, 240) || undefined,
  }).filter(([, value]) => value !== undefined && value !== '')) as ProductCard;
}

function categoryCard(category: any): CategoryCard {
  return Object.fromEntries(Object.entries({
    id: text(category?.id, 200),
    title: text(category?.title || category?.name, 300),
    slug: text(category?.slug, 240) || undefined,
    imageUrl: text(category?.imageUrl || category?.iconUrl, 1400) || undefined,
  }).filter(([, value]) => value !== undefined && value !== '')) as CategoryCard;
}

function uniqueById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export async function expandSalarDisplay(message: string, result: SalarResult) {
  const mode = result.displayMode || 'none';
  if (mode === 'none') return result;

  const state = await getSalarState();
  const catalogue = state.catalogue;
  if (!catalogue) return result;

  const query = text(result.context?.lastProductQuery || message, 1200);

  if (mode === 'categories') {
    const ranked = catalogue.categories
      .map((category: any, index: number) => ({
        category,
        index,
        score: query ? productSearchScore({ title: category?.title, name: category?.name, category: category?.title }, query) : 0,
      }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map((item) => categoryCard(item.category))
      .filter((item) => item.id && item.title);
    const selected = Array.isArray(result.categories) ? result.categories : [];
    return { ...result, categories: uniqueById([...selected, ...ranked]).slice(0, 30) };
  }

  if (mode !== 'products' && mode !== 'product_images') return result;

  const selected = Array.isArray(result.products) ? result.products : [];
  if (!selected.length) return result;

  const selectedIds = new Set(selected.map((product) => product.id));
  const alreadyShown = new Set((result.context?.shownProductIds || []).filter((id) => !selectedIds.has(id)));
  const firstCategory = normalizeSearchText(selected[0]?.category || '');
  const ranked = catalogue.products
    .map((product: any, index: number) => ({
      product,
      index,
      score: query ? productSearchScore(product, query) : 0,
      sameCategory: firstCategory && normalizeSearchText(product?.category) === firstCategory ? 1 : 0,
    }))
    .filter((item) => !alreadyShown.has(text(item.product?.id, 200)))
    .sort((a, b) => b.score - a.score || b.sameCategory - a.sameCategory || a.index - b.index)
    .map((item) => productCard(item.product))
    .filter((item) => item.id && item.title && (mode !== 'product_images' || item.imageUrl));

  const limit = mode === 'product_images' ? 30 : 20;
  const products = uniqueById([...selected, ...ranked]).slice(0, limit);
  const shownProductIds = [...(result.context?.shownProductIds || []), ...products.map((product) => product.id)]
    .filter(Boolean)
    .slice(-120);

  return {
    ...result,
    products,
    context: {
      ...(result.context || {}),
      lastProductQuery: query || result.context?.lastProductQuery,
      shownProductIds: [...new Set(shownProductIds)],
    },
  };
}
