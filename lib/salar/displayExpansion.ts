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
  reply?: string;
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

function relevanceFloor(topScore: number) {
  if (topScore >= 220) return Math.max(70, Math.floor(topScore * 0.42));
  if (topScore >= 140) return Math.max(48, Math.floor(topScore * 0.34));
  if (topScore >= 80) return Math.max(30, Math.floor(topScore * 0.28));
  return Math.max(12, Math.floor(topScore * 0.22));
}

function titleHasToken(product: any, token: string) {
  const title = normalizeSearchText(product?.title || product?.name);
  if (!title || !token) return false;
  const titleTokens = title.split(' ').filter(Boolean);
  if (titleTokens.some((candidate) => candidate === token || candidate.includes(token) || token.includes(candidate))) return true;
  const compactToken = token.replace(/\s+/g, '');
  return compactToken.length >= 4 && title.replace(/\s+/g, '').includes(compactToken);
}

function distinctiveTitleTokens(products: any[], query: string) {
  const normalizedTokens = [...new Set(normalizeSearchText(query).split(' ').filter((token) => token.length >= 3))];
  if (!normalizedTokens.length || !products.length) return [] as string[];
  const total = products.length;
  return normalizedTokens
    .map((token) => ({ token, count: products.reduce((sum, product) => sum + (titleHasToken(product, token) ? 1 : 0), 0) }))
    .filter((item) => item.count > 0 && item.count / total <= 0.35)
    .sort((a, b) => a.count - b.count || b.token.length - a.token.length)
    .slice(0, 5)
    .map((item) => item.token);
}

function keepBestExactTitleGroup<T extends { product: any; score: number }>(items: T[], catalogue: any[], query: string) {
  const tokens = distinctiveTitleTokens(catalogue, query);
  if (!tokens.length) return items;
  const withMatches = items.map((item) => ({
    item,
    matches: tokens.reduce((sum, token) => sum + (titleHasToken(item.product, token) ? 1 : 0), 0),
  }));
  const allTokens = withMatches.filter((entry) => entry.matches === tokens.length);
  if (allTokens.length) return allTokens.map((entry) => entry.item);
  const maxMatches = withMatches.reduce((max, entry) => Math.max(max, entry.matches), 0);
  if (maxMatches <= 0) return [];
  return withMatches.filter((entry) => entry.matches === maxMatches).map((entry) => entry.item);
}

export async function expandSalarDisplay(message: string, result: SalarResult): Promise<SalarResult> {
  const mode: DisplayMode = result.displayMode || 'none';
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
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map((item) => categoryCard(item.category))
      .filter((item) => item.id && item.title);
    const selected = Array.isArray(result.categories) ? result.categories : [];
    const categories = ranked.length ? uniqueById([...ranked, ...selected]).slice(0, 30) : selected.slice(0, 30);
    return { ...result, categories };
  }

  if (mode !== 'products' && mode !== 'product_images') return result;

  const selected = Array.isArray(result.products) ? result.products : [];
  const selectedIds = new Set(selected.map((product) => product.id));
  const alreadyShown = new Set((result.context?.shownProductIds || []).filter((id) => !selectedIds.has(id)));

  const scored = catalogue.products
    .map((product: any, index: number) => ({
      product,
      index,
      score: query ? productSearchScore(product, query) : 0,
    }))
    .filter((item) => item.score > 0 && !alreadyShown.has(text(item.product?.id, 200)))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const exactTitleScored = keepBestExactTitleGroup(scored, catalogue.products, query);
  const source = exactTitleScored.length || distinctiveTitleTokens(catalogue.products, query).length ? exactTitleScored : scored;
  const topScore = source[0]?.score || 0;
  const floor = relevanceFloor(topScore);
  const stronglyRelated = source
    .filter((item) => item.score >= floor)
    .map((item) => productCard(item.product))
    .filter((item) => item.id && item.title && (mode !== 'product_images' || item.imageUrl));

  let candidates = stronglyRelated;

  if (!candidates.length && selected.length && !distinctiveTitleTokens(catalogue.products, query).length) {
    const selectedCategory = normalizeSearchText(selected[0]?.category || '');
    candidates = catalogue.products
      .filter((product: any) => {
        const id = text(product?.id, 200);
        if (!id || alreadyShown.has(id)) return false;
        return selectedCategory && normalizeSearchText(product?.category) === selectedCategory;
      })
      .map(productCard)
      .filter((item) => item.id && item.title && (mode !== 'product_images' || item.imageUrl));
  }

  const selectedRelevant = selected.filter((product) => {
    if (!product.id || alreadyShown.has(product.id)) return false;
    const match = source.find((item) => text(item.product?.id, 200) === product.id);
    return !topScore || Boolean(match && match.score >= floor);
  });

  const limit = mode === 'product_images' ? 30 : 20;
  const products = uniqueById([...candidates, ...selectedRelevant]).slice(0, limit);
  const shownProductIds = [...(result.context?.shownProductIds || []), ...products.map((product) => product.id)]
    .filter(Boolean)
    .slice(-120);
  const nextDisplayMode: DisplayMode = products.length ? mode : 'none';

  return {
    ...result,
    products,
    displayMode: nextDisplayMode,
    context: {
      ...(result.context || {}),
      lastProductQuery: query || result.context?.lastProductQuery,
      shownProductIds: [...new Set(shownProductIds)],
    },
  };
}