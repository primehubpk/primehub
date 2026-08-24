import type { PriceBucket } from './types';

export function isWholesalePriceBucket(bucket: PriceBucket) {
  return bucket.title.toLowerCase().includes('wholesale') || !bucket.amount;
}

function bucketPriority(bucket: PriceBucket) {
  if (isWholesalePriceBucket(bucket)) return 3;

  const amount = Number(bucket.amount);
  if (amount === 99) return 0;
  if (amount === 299) return 1;
  if (amount === 999) return 2;
  return 4;
}

export function sortPriceBuckets(buckets: PriceBucket[]) {
  return [...buckets].sort((a, b) => {
    const priorityDifference = bucketPriority(a) - bucketPriority(b);
    if (priorityDifference !== 0) return priorityDifference;

    if (!isWholesalePriceBucket(a) && !isWholesalePriceBucket(b)) {
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
