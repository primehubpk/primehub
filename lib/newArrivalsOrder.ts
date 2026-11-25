import type { Product } from '@/components/shop/ShopTypes';

// The original listing/creation time controls placement. An edit must not
// push an older item above genuinely new arrivals.
function dateValue(value: unknown): number {
  if (value == null || value === '') return 0;
  if (typeof value === 'object') {
    const entry = value as { toMillis?: () => number; seconds?: number; _seconds?: number };
    if (typeof entry.toMillis === 'function') {
      const time = entry.toMillis();
      return Number.isFinite(time) && time > 0 ? time : 0;
    }
    const seconds = entry.seconds ?? entry._seconds;
    if (Number.isFinite(seconds)) return Number(seconds) * 1000;
  }
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) && time > 0 ? time : 0;
  }
  if (typeof value === 'number') {
    const time = value < 100_000_000_000 ? value * 1000 : value;
    return Number.isFinite(time) && time > 0 ? time : 0;
  }
  if (typeof value === 'string') {
    const time = Date.parse(value);
    return Number.isFinite(time) && time > 0 ? time : 0;
  }
  return 0;
}

export function orderNewArrivals(products: Product[]): Product[] {
  const seen = new Set<string>();
  return products
    .filter((product) => {
      if (!product || product.published === false || product.active === false ||
          !String(product.title || product.name || '').trim() || !String(product.id || '').trim()) return false;
      if (seen.has(product.id)) return false;
      seen.add(product.id);
      return true;
    })
    .sort((a, b) => {
      const first = dateValue(a.createdAt ?? a.created_at) ||
        dateValue(a.updatedAt ?? a.updated_at);
      const second = dateValue(b.createdAt ?? b.created_at) ||
        dateValue(b.updatedAt ?? b.updated_at);
      return second - first || String(b.id).localeCompare(String(a.id));
    });
}
