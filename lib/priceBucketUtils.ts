import type { PriceBucket } from './types';

const CANONICAL_PRICE_BUCKETS = [99, 299, 999];

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

export function priceBucketRange(
  buckets: PriceBucket[],
  amount: number,
): { minExclusive: number; maxInclusive: number } | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const retail = sortPriceBuckets(
    buckets.filter(
      (bucket) =>
        !isWholesalePriceBucket(bucket) &&
        Number(bucket.amount) > 0,
    ),
  );
  const index = retail.findIndex(
    (bucket) => Number(bucket.amount) === amount,
  );

  if (index >= 0) {
    return {
      minExclusive:
        index > 0 ? Number(retail[index - 1].amount || 0) : 0,
      maxInclusive: amount,
    };
  }

  const canonicalIndex = CANONICAL_PRICE_BUCKETS.indexOf(amount);
  if (canonicalIndex >= 0) {
    return {
      minExclusive:
        canonicalIndex > 0 ? CANONICAL_PRICE_BUCKETS[canonicalIndex - 1] : 0,
      maxInclusive: amount,
    };
  }

  return { minExclusive: 0, maxInclusive: amount };
}

export function matchesPriceBucket(
  price: number,
  buckets: PriceBucket[],
  amount: number,
) {
  const range = priceBucketRange(buckets, amount);
  if (!range || price <= 0) return false;
  return price > range.minExclusive && price <= range.maxInclusive;
}

export function normalizePriceBuckets(buckets: PriceBucket[]) {
  return sortPriceBuckets(buckets).map((bucket, index) => ({
    ...bucket,
    sortOrder: index + 1,
  }));
}
