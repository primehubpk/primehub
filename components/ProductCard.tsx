// ==================== PRODUCT URGENCY BADGES ====================
export function ProductUrgencyBadges({ stock, productId }: { stock?: number; productId: string }) {
  const viewers = 3 + (Array.from(productId).reduce((sum, character) => sum + character.charCodeAt(0), 0) % 24);
  return <div className="absolute bottom-2 left-2 right-2 space-y-1">{stock != null && stock > 0 && stock <= 5 && <span className="block w-fit rounded-full bg-[#FFB020] px-2 py-1 text-[8px] font-black text-[#14140F]">🔥 Only {stock} left in stock!</span>}<span className="block w-fit rounded-full bg-[#E1352B] px-2 py-1 text-[8px] font-black text-white">⚡ 78% Claimed - Limited Deal</span><span className="block w-fit rounded-full bg-white/90 px-2 py-1 text-[8px] font-black text-[#14140F]">👥 {viewers} viewing now</span></div>;
}
