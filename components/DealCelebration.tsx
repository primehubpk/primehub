'use client';

import { useEffect, useState } from 'react';

const PARTICLES = Array.from({ length: 14 }, (_, index) => index);

export default function DealCelebration() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 2000);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[80] overflow-hidden" aria-hidden="true">
      <div className="absolute left-1/2 top-1/3 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-300/20 blur-3xl animate-pulse" />
      <div className="absolute left-1/2 top-1/3 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-300/50 animate-ping" />
      {PARTICLES.map((particle) => (
        <span
          key={particle}
          className="absolute left-1/2 top-1/3 h-1.5 w-1.5 rounded-full bg-amber-300 opacity-80 animate-ping"
          style={{
            transform: `rotate(${particle * 25.7}deg) translateY(-${55 + (particle % 4) * 18}px)`,
            animationDelay: `${(particle % 5) * 90}ms`,
            animationDuration: '900ms',
          }}
        />
      ))}
    </div>
  );
}
