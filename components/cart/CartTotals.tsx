export default function CartTotals({
  subtotal,
}: {
  subtotal: number;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="font-bold text-black/50">Subtotal</span>
        <span className="font-[family-name:var(--font-mono)] font-black text-[#14140F]">
          Rs. {subtotal.toLocaleString()}
        </span>
      </div>

      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="font-bold text-black/50">Shipping</span>
        <span className="text-right text-xs font-extrabold text-black/55">
          Calculated at Checkout
        </span>
      </div>

      <div className="h-px bg-black/[0.08]" />

      <div className="flex items-end justify-between gap-4">
        <span className="text-base font-black text-[#14140F]">Total</span>
        <span className="font-[family-name:var(--font-mono)] text-2xl font-black tracking-tight text-[#14140F]">
          Rs. {subtotal.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
