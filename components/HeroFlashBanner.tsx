// components/HeroFlashBanner.tsx
// SECTION 2: Daily flash sale banner + live ticking countdown timer.

'use client';

import { useEffect, useState } from 'react';
import { Flame } from 'lucide-react';

// =====================================================================
// SECTION: CONFIG — swap this URL daily for the new flash-sale creative
// =====================================================================
const DAILY_BANNER_IMAGE =
  'https://images.unsplash.com/photo-1607082349566-187342175e2f?q=80&w=1200&auto=format&fit=crop';

const INITIAL_SECONDS = 2 * 3600 + 14 * 60 + 55; // 02:14:55

function pad2(n: number) {
  return n.toString().padStart(2, '0');
}

export default function HeroFlashBanner() {
  const [secondsLeft, setSecondsLeft] = useState(INITIAL_SECONDS);

  useEffect(() => {
    const id = setInterval(() => {
      setSecondsLeft((s) => (s <= 0 ? 6 * 3600 : s - 1)); // auto-resets to a fresh 6h cycle
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const hours = Math.floor(secondsLeft / 3600);
  const mins = Math.floor((secondsLeft % 3600) / 60);
  const secs = secondsLeft % 60;

  return (
    <section className="max-w-md mx-auto px-4 mt-4">
      <div
        className="relative rounded-2xl overflow-hidden h-44 bg-[#14140F] bg-cover bg-center"
        style={{ backgroundImage: `url(${DAILY_BANNER_IMAGE})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />
        <div className="relative h-full flex flex-col justify-end p-4">
          <span className="inline-flex items-center gap-1 self-start bg-[#E1352B] text-white text-[10px] font-bold px-2.5 py-1 rounded-full mb-2">
            <Flame className="w-3 h-3" aria-hidden="true" /> TODAY ONLY
          </span>
          <p className="text-white font-[family-name:var(--font-display)] text-2xl font-bold leading-tight">
            Up to 70% Off
          </p>
          <div className="flex items-center gap-1.5 mt-2 font-[family-name:var(--font-mono)]">
            {[hours, mins, secs].map((val, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="bg-white/95 text-[#14140F] text-sm font-bold rounded-md px-2 py-1 min-w-[30px] text-center">
                  {pad2(val)}
                </div>
                {i < 2 && <span className="text-white font-bold">:</span>}
              </div>
            ))}
            <span className="text-white/70 text-[10px] ml-1">left</span>
          </div>
        </div>
      </div>
    </section>
  );
}
