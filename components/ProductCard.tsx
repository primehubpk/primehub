'use client';

import { useEffect, useState } from 'react';

// ==================== PRODUCT URGENCY BADGES ====================
export function ProductUrgencyBadges({ stock, productId }: { stock?: number; productId: string }) {
  const seed = Array.from(productId).reduce((sum, character) => sum + character.charCodeAt(0), 0);
  const [viewers, setViewers] = useState(() => 6 + (seed % 20));

  useEffect(() => {
    // Keep the social-proof number feeling alive without making it jump constantly.
    const interval = window.setInterval(() => {
      setViewers((current) => {
        const direction = Math.random() > 0.5 ? 1 : -1;
        const step = Math.random() > 0.72 ? 2 : 1;
        const next = current + direction * step;
        return Math.max(5, Math.min(32, next));
      });
    }, 7000 + Math.floor(Math.random() * 6000));

    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="absolute bottom-2 left-2 right-2 space-y-1">
      {stock != null && stock > 0 && stock <= 5 && (
        <span className="block w-fit rounded-full bg-[#FFB020] px-2 py-1 text-[8px] font-black text-[#14140F]">
          🔥 Only {stock} left in stock!
        </span>
      )}
      <span className="block w-fit rounded-full bg-[#E1352B] px-2 py-1 text-[8px] font-black text-white">
        ⚡ 78% Claimed - Limited Deal
      </span>
      <span className="block w-fit rounded-full bg-white/90 px-2 py-1 text-[8px] font-black text-[#14140F] transition-all duration-500">
        👥 {viewers} viewing now
      </span>
    </div>
  );
}
