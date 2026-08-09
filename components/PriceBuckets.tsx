'use client';

import Link from 'next/link';

import { useMemo } from 'react';
import { SlidersHorizontal, Sparkles } from 'lucide-react';
import { useSettings } from '@/lib/useSettings';

interface PriceBucketsProps {
  selectedMaxPrice: number | null;
  onSelect: (amount: number | null) => void;
}

export default function PriceBuckets({
  selectedMaxPrice,
  onSelect,
}: PriceBucketsProps) {
  const { settings, loading } = useSettings();

  const buckets = useMemo(
    () =>
      [...(settings.priceBuckets || [])]
        .filter((bucket) => bucket.active)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [settings.priceBuckets]
  );

  if (loading || buckets.length === 0) return null;

  return (
    <section className="mt-7 px-4">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-[#E1352B]">
            <Sparkles size={13} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">
              Smart price picks
            </span>
          </div>
          <h2 className="text-xl font-black tracking-tight text-[#14140F]">
            Shop by budget
          </h2>
        </div>

        {selectedMaxPrice !== null && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#14140F] px-3 py-1.5 text-[10px] font-black text-white"
          >
            <SlidersHorizontal size={12} />
            Clear
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {buckets.map((bucket) => {
          const selected = selectedMaxPrice === bucket.amount;

          return (
            <button
              key={bucket.id}
              type="button"
              onClick={() => onSelect(selected ? null : bucket.amount)}
              className={[
                'relative overflow-hidden rounded-2xl border p-3 text-left transition active:scale-[0.98]',
                selected
                  ? 'border-[#14140F] bg-[#14140F] text-white shadow-lg'
                  : 'border-black/8 bg-white text-[#14140F] shadow-[0_8px_25px_rgba(20,20,15,0.06)] hover:-translate-y-0.5',
              ].join(' ')}
            >
              <div
                className="absolute -right-5 -top-5 h-14 w-14 rounded-full opacity-20"
                style={{ background: bucket.accent || '#FFB020' }}
              />

              {bucket.iconUrl ? (
                <img
                  src={bucket.iconUrl}
                  alt=""
                  className="mb-2 h-9 w-9 rounded-xl object-cover"
                />
              ) : (
                <div
                  className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl text-xs font-black"
                  style={{
                    background: bucket.accent || '#FFB020',
                    color: '#14140F',
                  }}
                >
                  ₨
                </div>
              )}

              <p className="text-[10px] font-black uppercase tracking-wider opacity-60">
                Best finds
              </p>
              <p className="mt-0.5 text-sm font-black">{bucket.title}</p>
              <p className="mt-1 font-[family-name:var(--font-mono)] text-[10px] opacity-55">
                Products ≤ Rs. {bucket.amount.toLocaleString()}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
