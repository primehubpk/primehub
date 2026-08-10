'use client';

import { useEffect, useState } from 'react';

export function ProductUrgencyBadges({ stock, productId, claimedPercent }: { stock?: number; productId: string; claimedPercent?: number }) {
  const seed = Array.from(productId).reduce((sum, character) => sum + character.charCodeAt(0), 0);
  const [viewers, setViewers] = useState(() => 6 + (seed % 20));

  useEffect(() => {
    const interval = window.setInterval(() => {
      setViewers((current) => {
        const direction = Math.random() > 0.5 ? 1 : -1;
        const step = Math.random() > 0.72 ? 2 : 1;
        return Math.max(5, Math.min(32, current + direction * step));
      });
    }, 7000 + Math.floor(Math.random() * 6000));
    return () => window.clearInterval(interval);
  }, []);

  const claimed = Number(claimedPercent);
  const hasClaimed = Number.isFinite(claimed) && claimed > 0 && claimed <= 100;

  return (
    <div className="absolute bottom-2 left-2 right-2 space-y-1">
      {stock != null && stock > 0 && stock <= 5 && (
        <span className="block w-fit rounded-full bg-[#FFB020] px-2 py-1 text-[8px] font-black text-[#14140F]">🔥 Only {stock} left in stock!</span>
      )}
      {hasClaimed && (
        <span className="block w-fit rounded-full bg-[#E1352B] px-2 py-1 text-[8px] font-black text-white">⚡ {Math.round(claimed)}% claimed · Limited deal</span>
      )}
      <span className="block w-fit rounded-full bg-white/90 px-2 py-1 text-[8px] font-black text-[#14140F] transition-all duration-500">👥 {viewers} viewing now</span>
    </div>
  );
}
