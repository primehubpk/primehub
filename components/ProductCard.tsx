'use client';


export function ProductUrgencyBadges({ stock, claimedPercent }: { stock?: number; productId: string; claimedPercent?: number }) {
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
    </div>
  );
}
