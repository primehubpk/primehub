// components/CategorySwiper.tsx
// SECTION 5: Shop by Category — horizontal scroll/swipe container.

import { ChevronRight } from 'lucide-react';

const CATEGORIES = [
  { name: 'Bangles', initial: 'B' },
  { name: 'Kitchen', initial: 'K' },
  { name: 'Tech', initial: 'T' },
  { name: 'Beauty', initial: 'B' },
  { name: 'Home', initial: 'H' },
];

export default function CategorySwiper() {
  return (
    <section className="max-w-md mx-auto px-4 mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-[family-name:var(--font-display)] font-bold text-base">
          Shop by Category
        </h2>
        <button
          type="button"
          className="text-[11px] font-semibold text-[#0F6A5F] flex items-center gap-0.5"
        >
          View all <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory scrollbar-hide">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.name}
            type="button"
            className="flex flex-col items-center gap-1.5 shrink-0 snap-start active:scale-95 transition"
          >
            <div className="w-14 h-14 rounded-full bg-white border border-black/10 flex items-center justify-center font-[family-name:var(--font-display)] font-bold text-[#0F6A5F]">
              {cat.initial}
            </div>
            <span className="text-[11px] text-black/70">{cat.name}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
