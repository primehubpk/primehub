// components/PriceBuckets.tsx
// SECTION 4: Clickable price bucket badges — "Under 99", "Under 499",
// "Under 999". In production, selecting one should filter ProductGrid
// (e.g. lift this state up or move it into a shared filter store).

'use client';

import { useState } from 'react';

const PRICE_BUCKETS = ['Under 99', 'Under 499', 'Under 999'];

export default function PriceBuckets() {
  const [activeBucket, setActiveBucket] = useState<string | null>(null);

  return (
    <section className="max-w-md mx-auto px-4 mt-6">
      <div className="flex gap-2">
        {PRICE_BUCKETS.map((label) => {
          const isActive = activeBucket === label;
          return (
            <button
              key={label}
              type="button"
              onClick={() => setActiveBucket(isActive ? null : label)}
              aria-pressed={isActive}
              className={`flex-1 text-xs font-semibold py-2.5 rounded-full border transition ${
                isActive
                  ? 'bg-[#14140F] text-white border-[#14140F]'
                  : 'bg-white text-[#14140F] border-black/10 active:scale-95'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
