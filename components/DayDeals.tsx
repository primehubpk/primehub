// components/DayDeals.tsx
// SECTION 3: Weekend Glow Deals — glowing discount badges with a
// highlighted Saturday/Sunday special card.

import { Sparkles } from 'lucide-react';

// =====================================================================
// SECTION: CONFIG — set which day is "special" and its deals
// =====================================================================
const WEEKEND_DEALS = [
  { discount: '-40%', special: false },
  { discount: '-25%', special: false },
  { discount: '-50%', special: true }, // highlighted as the Sat/Sun special
];

function isWeekend() {
  const day = new Date().getDay(); // 0 = Sunday, 6 = Saturday
  return day === 0 || day === 6;
}

export default function DayDeals() {
  const weekendActive = isWeekend();

  return (
    <section className="max-w-md mx-auto px-4 mt-6">
      <div className="flex items-center gap-1.5 mb-3">
        <Sparkles className="w-4 h-4 text-[#FFB020]" aria-hidden="true" />
        <h2 className="font-[family-name:var(--font-display)] font-bold text-base">
          {weekendActive ? 'Weekend Glow Deals — Live Now' : 'Weekend Glow Deals'}
        </h2>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {WEEKEND_DEALS.map((deal, i) => (
          <div
            key={i}
            className={`relative rounded-xl p-3 text-center bg-white border ${
              deal.special
                ? 'border-[#FFB020] ring-2 ring-[#FFB020]/40'
                : 'border-black/10'
            }`}
          >
            <div className="h-14 rounded-lg bg-[#F4F4F1] mb-2" />
            <span className="inline-block text-[11px] font-bold text-white px-2 py-0.5 rounded-full bg-[#E1352B] animate-pulse-glow">
              {deal.discount}
            </span>
            {deal.special && (
              <span className="block mt-1 text-[9px] font-semibold text-[#FFB020]">
                {new Date().getDay() === 0 ? 'SUN SPECIAL' : 'SAT SPECIAL'}
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
