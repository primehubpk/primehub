import type { PriceBucket } from './types';

export function isWholesalePriceBucket(bucket: PriceBucket) {
  return bucket.title.toLowerCase().includes('wholesale') || !bucket.amount;
}

export function sortPriceBuckets(buckets: PriceBucket[]) {
  return [...buckets].sort((a, b) => {
    const aWholesale = isWholesalePriceBucket(a);
    const bWholesale = isWholesalePriceBucket(b);

    if (aWholesale !== bWholesale) return aWholesale ? 1 : -1;

    if (!aWholesale && !bWholesale) {
      const amountDifference = Number(a.amount) - Number(b.amount);
      if (amountDifference !== 0) return amountDifference;
    }

    return Number(a.sortOrder) - Number(b.sortOrder);
  });
}

export function normalizePriceBuckets(buckets: PriceBucket[]) {
  return sortPriceBuckets(buckets).map((bucket, index) => ({
    ...bucket,
    sortOrder: index + 1,
  }));
}
