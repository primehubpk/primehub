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
      try { return candidate.toDate().getTime(); } catch { return 0; }
    }
    const seconds = Number(candidate.seconds ?? candidate._seconds ?? 0);
    return Number.isFinite(seconds) ? seconds * 1000 : 0;
  }
  return 0;
}

function productTime(item: unknown): number {
  if (!item || typeof item !== 'object') return 0;
  const product = item as ShuffleableProduct;
  return Math.max(
    timestamp(product.createdAt),
    timestamp(product.created_at),
    timestamp(product.uploadedAt),
    timestamp(product.updatedAt),
    timestamp(product.updated_at),
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
    if (item && typeof item === 'object' && isWholesaleProduct(item as ShuffleableProduct)) {
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
