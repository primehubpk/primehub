'use client';

import { useEffect, useState } from 'react';

const BURSTS = [
  { left: '10%', top: '22%', delay: '0ms', scale: 1 },
  { left: '88%', top: '20%', delay: '180ms', scale: 0.85 },
  { left: '18%', top: '68%', delay: '320ms', scale: 0.7 },
  { left: '82%', top: '64%', delay: '120ms', scale: 0.75 },
  { left: '50%', top: '14%', delay: '260ms', scale: 0.65 },
];

const PARTICLES = Array.from({ length: 30 }, (_, index) => index);

export default function DealCelebration() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 2000);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[80] overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(16,185,129,.12),transparent_30%),radial-gradient(circle_at_15%_35%,rgba(225,53,43,.1),transparent_24%),radial-gradient(circle_at_85%_38%,rgba(255,176,32,.1),transparent_24%)] animate-pulse" />
      <div className="absolute left-1/2 top-1/2 h-[45vh] w-[45vw] min-w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 shadow-[0_0_100px_rgba(16,185,129,.12)] animate-ping" />

      {BURSTS.map((burst) => (
        <div
          key={`${burst.left}-${burst.top}`}
          className="absolute h-24 w-24 -translate-x-1/2 -translate-y-1/2 animate-pulse"
          style={{ left: burst.left, top: burst.top, animationDelay: burst.delay, transform: `translate(-50%, -50%) scale(${burst.scale})` }}
        >
          <div className="absolute inset-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FFB020] shadow-[0_0_24px_rgba(255,176,32,.9)]" />
          {Array.from({ length: 12 }, (_, ray) => (
            <span
              key={ray}
              className="absolute left-1/2 top-1/2 h-1 w-9 origin-left rounded-full bg-gradient-to-r from-[#FFB020] to-transparent opacity-80"
              style={{ transform: `rotate(${ray * 30}deg) translateX(7px)`, animationDelay: `${ray * 35}ms` }}
            />
          ))}
        </div>
      ))}

      {PARTICLES.map((particle) => {
        const angle = particle * 12;
        const distance = 18 + (particle % 6) * 7;
        return (
          <span
            key={particle}
            className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,.8)] animate-ping"
            style={{
              transform: `rotate(${angle}deg) translateY(-${distance}vh)`,
              animationDelay: `${(particle % 8) * 70}ms`,
              animationDuration: '850ms',
            }}
          />
        );
      })}
    </div>
  );
}
