import { isWholesaleProduct } from '@/lib/wholesale';

type ShuffleableProduct = {
  createdAt?: unknown;
  created_at?: unknown;
  uploadedAt?: unknown;
  updatedAt?: unknown;
  updated_at?: unknown;
  [key: string]: unknown;
};

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function timestamp(value: unknown): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value === 'object') {
    const candidate = value as { seconds?: unknown; _seconds?: unknown; toDate?: () => Date };
    if (typeof candidate.toDate === 'function') {
      try {
        return candidate.toDate().getTime();
      } catch {
        return 0;
      }
    }
    const seconds = Number(candidate.seconds ?? candidate._seconds ?? 0);
    return Number.isFinite(seconds) ? seconds * 1000 : 0;
  }
  return 0;
}

function productTime(item: unknown): number {
  if (!item || typeof item !== 'object') return 0;
  const product = item as ShuffleableProduct;

  // Upload/creation time is authoritative for "new arrivals". Updated time is
  // only a fallback so editing an older wholesale product does not make it new.
  return (
    timestamp(product.createdAt) ||
    timestamp(product.created_at) ||
    timestamp(product.uploadedAt) ||
    timestamp(product.updatedAt) ||
    timestamp(product.updated_at)
  );
}

export function shuffleProducts<T>(items: T[]): T[] {
  const result = shuffle(items);

  // Wholesale Deal keeps the newest uploads at the front while still changing
  // their order on every fresh page load. Other catalog sections keep the
  // existing full random shuffle behaviour.
  const wholesaleSlots: number[] = [];
  const wholesaleItems: T[] = [];

  result.forEach((item, index) => {
    if (item && typeof item === 'object' && isWholesaleProduct(item as any)) {
      wholesaleSlots.push(index);
      wholesaleItems.push(item);
    }
  });

  if (wholesaleItems.length < 2) return result;

  const newestFirst = [...wholesaleItems].sort((a, b) => productTime(b) - productTime(a));
  const recentCount = Math.min(6, newestFirst.length);
  const orderedWholesale = [
    ...shuffle(newestFirst.slice(0, recentCount)),
    ...shuffle(newestFirst.slice(recentCount)),
  ];

  wholesaleSlots.forEach((slot, index) => {
    result[slot] = orderedWholesale[index];
  });

  return result;
}

/** Stable per-visit ranking: refetches/price edits cannot reshuffle existing IDs.
 * Runs in memory, with no query strings, fetches or database writes. */
export function shuffleForVisit<T>(items: readonly T[], seed: number, namespace = ''): T[] {
  const identity = (item: T) => {
    const value = item as { id?: unknown; product?: { id?: unknown } };
    return String(value?.product?.id ?? value?.id ?? '');
  };
  const rank = (id: string) => {
    let hash = 2166136261;
    const text = `${seed}:${namespace}:${id}`;
    for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
    hash ^= hash >>> 16; hash = Math.imul(hash, 0x7feb352d);
    hash ^= hash >>> 15; hash = Math.imul(hash, 0x846ca68b);
    return (hash ^ (hash >>> 16)) >>> 0;
  };
  return items.map((item, index) => ({ item, index, id: identity(item), rank: rank(identity(item)) }))
    .sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id) || a.index - b.index)
    .map(row => row.item);
}


/** Owner policy: recent uploads lead each fresh visit; preserve every real item. */
export function recentProductsForVisit<T>(items: readonly T[], seed: number, namespace: string, previousFirst = ''): T[] {
  if (items.length < 2) return [...items];
  const product = (item: T) => (item as { product?: unknown })?.product || item;
  const id = (item: T) => String((product(item) as { id?: unknown })?.id || '');
  const dated = [...items].filter(item => productTime(product(item)) > 0)
    .sort((a, b) => productTime(product(b)) - productTime(product(a)) || id(a).localeCompare(id(b)));
  const recent = dated.slice(0, Math.min(12, Math.max(2, Math.ceil(items.length / 4))));
  const recentIds = new Set(recent.map(id));
  const result = [...shuffleForVisit(recent, seed, namespace + ':new'),
    ...shuffleForVisit(items.filter(item => !recentIds.has(id(item))), seed, namespace + ':rest')];
  // A two-product collection also visibly changes on refresh, not just its seed.
  if (previousFirst && id(result[0]) === previousFirst) {
    const next = result.findIndex(item => id(item) !== previousFirst);
    if (next > 0) [result[0], result[next]] = [result[next], result[0]];
  }
  return result;
}
