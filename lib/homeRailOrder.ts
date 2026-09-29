import type { Product } from '@/components/shop/ShopTypes';

export function railSeed() {
  const values = new Uint32Array(1);
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(values);
    return values[0] || 1;
  }
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

function unit(seed: number, id: string) {
  let hash = (seed ^ 2166136261) >>> 0;
  for (const char of id) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  }
  return hash / 0xffffffff;
}

function productTime(product: Product) {
  const value = product.createdAt || product.updatedAt;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  const parsed = new Date(value || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

// On the server seed 0 preserves the database order. The browser shuffles once
// after hydration, so a page refresh never causes a hydration mismatch or ISR write.
export function orderHomeProducts<T extends Product>(items: T[], seed: number): T[] {
  if (!seed || items.length < 2) return items;
  const newest = [...items].sort((a, b) => productTime(b) - productTime(a) || a.id.localeCompare(b.id));
  const dated = newest.filter((item) => productTime(item) > 0);
  const freshness = new Map(dated.map((item, index) => [item.id, 1 - index / Math.max(1, dated.length - 1)]));
  return [...items].sort((a, b) =>
    (unit(seed, b.id) * .55 + (freshness.get(b.id) || 0) * .9) -
    (unit(seed, a.id) * .55 + (freshness.get(a.id) || 0) * .9) || a.id.localeCompare(b.id));
}

export function orderHomeCards<T extends { id: string; createdAt?: unknown; updatedAt?: unknown }>(items: T[], seed: number) {
  if (!seed || items.length < 2) return items;
  const timeOf = (item: T) => new Date(String(item.createdAt || item.updatedAt || 0)).getTime() || 0;
  const dated = [...items].filter((item) => timeOf(item) > 0)
    .sort((a, b) => timeOf(b) - timeOf(a));
  const freshness = new Map(dated.map((item, index) => [item.id, 1 - index / Math.max(1, dated.length - 1)]));
  return [...items].sort((a, b) =>
    (unit(seed, b.id) * .55 + (freshness.get(b.id) || 0) * .9) -
    (unit(seed, a.id) * .55 + (freshness.get(a.id) || 0) * .9) || a.id.localeCompare(b.id));
}
