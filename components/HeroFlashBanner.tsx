// components/HeroFlashBanner.tsx
// SECTION 2: Daily flash sale banner + live ticking countdown timer.
//
// UPDATED: heroTitle, heroDiscountText, and heroCountdownEndTime now
// come live from Firestore (`settings/main`) via the shared useSettings
// hook. The banner image URL stays a local constant below — swap it
// here (or move it into Firestore too later if you want it admin-editable).

'use client';

import { useEffect, useState } from 'react';
import { Flame } from 'lucide-react';
import { useSettings } from '@/lib/useSettings';

// ==========================================
// SECTION: CONFIG — swap this URL daily for the new flash-sale creative
// ==========================================
const DAILY_BANNER_IMAGE =
  'https://images.unsplash.com/photo-1607082349566-187342175e2f?q=80&w=1200&auto=format&fit=crop';

function pad2(n: number) {
  return n.toString().padStart(2, '0');
}

export default function HeroFlashBanner() {
  const { settings } = useSettings();
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    function tick() {
      const end = new Date(settings.heroCountdownEndTime).getTime();
      const now = Date.now();
      setSecondsLeft(Math.max(0, Math.floor((end - now) / 1000)));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [settings.heroCountdownEndTime]);

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
            <Flame className="w-3 h-3" aria-hidden="true" /> {settings.heroTitle}
          </span>
          <p className="text-white font-[family-name:var(--font-display)] text-2xl font-bold leading-tight">
            {settings.heroDiscountText}
          </p>
          {secondsLeft > 0 ? (
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
          ) : (
            <p className="text-white/80 text-xs mt-2">Sale ended — check back soon</p>
          )}
        </div>
      </div>
    </section>
  );
}
