'use client';

import { useEffect, useState } from 'react';
import { Clock3 } from 'lucide-react';

function remaining(target: string) {
  const milliseconds = Math.max(0, new Date(target).getTime() - Date.now());
  const totalSeconds = Math.floor(milliseconds / 1000);
  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    done: totalSeconds <= 0,
  };
}

export default function DealCountdown({ target }: { target: string }) {
  const [time, setTime] = useState(() => remaining(target));

  useEffect(() => {
    const tick = () => setTime(remaining(target));
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [target]);

  const pad = (value: number) => String(value).padStart(2, '0');

  return (
    <div className="rounded-[24px] border border-[#E1352B]/15 bg-[#FFF7F4] p-4">
      <div className="flex items-center gap-2 text-[#E1352B]">
        <Clock3 size={16} />
        <span className="text-[9px] font-black uppercase tracking-[0.2em]">Offer ends at midnight Pakistan time</span>
      </div>
      <div className="mt-2 flex items-end gap-1 font-[family-name:var(--font-mono)] text-3xl font-black tracking-tight text-[#14140F] sm:text-4xl">
        <span>{pad(time.hours)}</span><span className="pb-1 text-[#E1352B]">:</span>
        <span>{pad(time.minutes)}</span><span className="pb-1 text-[#E1352B]">:</span>
        <span>{pad(time.seconds)}</span>
      </div>
      {time.done && <p className="mt-1 text-[10px] font-bold text-[#E1352B]">This live deal has ended. Refresh to see the current day.</p>}
    </div>
  );
}
