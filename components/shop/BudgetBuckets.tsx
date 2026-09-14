'use client';

import Link from 'next/link';
import { Flame, Grid2X2, Package, Sparkles, Star, Tag } from 'lucide-react';

type Bucket = {
  id: string;
  title?: string;
  amount?: number | null;
  accent?: string;
  iconUrl?: string;
};

type Props = {
  buckets: Bucket[];
  maxPrice: string;
  setMaxPrice: (value: string) => void;
  wholesaleOnly: boolean;
  setWholesaleOnly: (value: boolean) => void;
};

function isWholesaleBucket(bucket: Bucket) {
  return String(bucket.title || '').toLowerCase().includes('wholesale') || Number(bucket.amount) === 0 || bucket.amount == null;
}

const pillClass =
  'inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-[#E8E1D7] bg-white px-4 text-[11px] font-black text-[#242019] shadow-[0_6px_18px_rgba(44,37,28,0.06)] transition hover:-translate-y-0.5 hover:border-[#D8C8B2] active:scale-[0.98]';

export default function BudgetBuckets({ buckets, maxPrice, setMaxPrice, wholesaleOnly, setWholesaleOnly }: Props) {
  const priceBuckets = [99, 299, 999].map((amount) =>
    buckets.find((bucket) => !isWholesaleBucket(bucket) && Number(bucket.amount) === amount) || {
      id: `budget-${amount}`,
      title: `Under Rs. ${amount}`,
      amount,
    },
  );

  return (
    <section className="mt-3" aria-label="Shop shortcuts">
      <div className="flex gap-2.5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Link
          href="/shop"
          prefetch
          onClick={() => {
            setMaxPrice('all');
            setWholesaleOnly(false);
          }}
          className={`${pillClass} ${maxPrice === 'all' && !wholesaleOnly ? '!border-[#0F6A5F] !bg-[#0F6A5F] !text-white' : ''}`}
        >
          <Grid2X2 size={16} /> All Products
        </Link>

        <Link href="/shop?sort=best-selling" prefetch className={pillClass}>
          <Flame size={16} className="text-[#E58B12]" /> Best Sellers
        </Link>

        <Link href="/new-arrivals" prefetch className={pillClass}>
          <Star size={16} className="text-[#C98B16]" /> New Arrivals
        </Link>

        {priceBuckets.map((bucket) => {
          const selected = !wholesaleOnly && maxPrice === String(bucket.amount);
          return (
            <button
              key={bucket.id}
              type="button"
              onClick={() => {
                setWholesaleOnly(false);
                setMaxPrice(selected ? 'all' : String(bucket.amount));
              }}
              className={`${pillClass} ${selected ? '!border-[#0F6A5F] !bg-[#EAF5F1] !text-[#0F6A5F]' : ''}`}
              aria-pressed={selected}
            >
              <Tag size={16} className="text-[#C98B16]" /> Under Rs. {Number(bucket.amount).toLocaleString()}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => {
            setWholesaleOnly(!wholesaleOnly);
            setMaxPrice('all');
          }}
          className={`${pillClass} ${wholesaleOnly ? '!border-[#0F6A5F] !bg-[#EAF5F1] !text-[#0F6A5F]' : ''}`}
          aria-pressed={wholesaleOnly}
        >
          <Package size={16} className="text-[#C98B16]" /> Wholesale Deals
        </button>

        {(maxPrice !== 'all' || wholesaleOnly) && (
          <button
            type="button"
            onClick={() => {
              setMaxPrice('all');
              setWholesaleOnly(false);
            }}
            className={pillClass}
          >
            <Sparkles size={16} className="text-[#0F6A5F]" /> Clear
          </button>
        )}
      </div>
    </section>
  );
}
