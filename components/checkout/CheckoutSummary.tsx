'use client';
import { imageOf, priceOf, titleOf } from './useCheckout';

type Props = { items: any[]; totalItems: number; subtotal: number; deliveryCharge: number; wholesaleItems: number; total: number };
export default function CheckoutSummary({ items, totalItems, subtotal, deliveryCharge, wholesaleItems, total }: Props) {
  return <aside className="h-fit rounded-[28px] bg-white p-5 shadow-sm md:sticky md:top-4">
    <div className="flex items-center justify-between"><h2 className="text-sm font-black">Your Order</h2><span className="text-[10px] font-black text-black/35">{totalItems} items</span></div>
    <div className="mt-4 space-y-3">{items.map((item: any, index: number) => { const qty = Number(item.quantity || item.qty || 1), variant = item.variant; return <div key={`${item.id || item.productId || index}`} className="flex gap-3"><div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[#F4F4F1]">{imageOf(item) && <img src={imageOf(item)} alt="" className="h-full w-full object-cover" />}</div><div className="min-w-0 flex-1"><p className="line-clamp-2 text-[10px] font-black">{titleOf(item)}</p>{variant && <p className="mt-1 text-[9px] font-bold text-[#0F6A5F]">{[variant.color && `Color: ${variant.color}`, variant.size && `Size: ${variant.size}`].filter(Boolean).join(' • ')}</p>}<p className="mt-1 text-[9px] font-bold text-black/40">Qty {qty}</p></div><p className="font-[family-name:var(--font-mono)] text-[10px] font-black">Rs. {(priceOf(item) * qty).toLocaleString()}</p></div>; })}</div>
    <div className="my-4 h-px bg-black/8" />
    <div className="space-y-2 text-xs"><div className="flex justify-between text-black/55"><span>Subtotal</span><strong>Rs. {subtotal.toLocaleString()}</strong></div><div className="flex justify-between text-black/55"><span>Delivery</span><strong>Rs. {deliveryCharge.toLocaleString()}</strong></div>{wholesaleItems > 0 && <p className="text-[9px] leading-4 text-[#E85D04]">Includes Rs. 350 base + {wholesaleItems} wholesale item{wholesaleItems === 1 ? '' : 's'} × Rs. 30.</p>}<div className="flex items-center justify-between border-t border-black/8 pt-3"><span className="font-black">Grand Total</span><span className="font-[family-name:var(--font-mono)] text-xl font-black">Rs. {total.toLocaleString()}</span></div></div>
    <p className="mt-3 rounded-2xl bg-[#0F6A5F]/8 p-3 text-[9px] font-bold leading-4 text-[#0F6A5F]">🚚 Standard delivery is Rs. 350. Wholesale items add Rs. 30 per item.</p>
  </aside>;
}
