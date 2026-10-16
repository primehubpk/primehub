export default function CartTotals({
  subtotal, deliveryCharge, total, discount = 0, selfCollect = false, deliveryReward = '',
}: {
  subtotal: number;
  deliveryCharge: number;
  total: number;
  discount?: number;
  selfCollect?: boolean;
  deliveryReward?: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="font-bold text-black/50">Products subtotal</span>
        <span className="font-[family-name:var(--font-mono)] font-black text-[#14140F]">Rs. {subtotal.toLocaleString()}</span>
      </div>
      {discount > 0 && <div className="flex items-center justify-between gap-4 text-xs font-bold text-[#0F6A5F]">
        <span>Voucher discount (eligible products)</span>
        <span>- Rs. {discount.toLocaleString()}</span>
      </div>}
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="font-bold text-black/50">{selfCollect ? 'Self Collect' : 'Shipping charges'}</span>
        <span className="text-right text-xs font-extrabold text-black/55">
          {deliveryCharge === 0 ? <span className="text-[#0F6A5F]">FREE · Rs. 0</span> : `Rs. ${deliveryCharge.toLocaleString()}`}
        </span>
      </div>
      {deliveryReward && <p className="text-[10px] font-bold text-[#0F6A5F]">{deliveryReward}</p>}
      <div className="h-px bg-black/[0.08]" />
      <div className="flex items-end justify-between gap-4">
        <span className="text-base font-black text-[#14140F]">Total</span>
        <span className="font-[family-name:var(--font-mono)] text-2xl font-black tracking-tight text-[#14140F]">Rs. {total.toLocaleString()}</span>
      </div>
    </div>
  );
}
