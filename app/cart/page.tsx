'use client';

import Link from 'next/link';
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { useCartStore } from '@/lib/cartStore';
import RewardsVoucherPanel from '@/components/RewardsVoucherPanel';
import { useRewardsStore } from '@/lib/rewardsStore';

export default function CartPage() {
  const items = useCartStore((s) => s.items);
  const updateQty = useCartStore((s) => s.updateQty);
  const removeItem = useCartStore((s) => s.removeItem);
  const subtotal = useCartStore((s) => s.getSubtotal());
  const getRewardsDiscount = useRewardsStore((s) => s.getRewardsDiscount);
  const rewardsDiscount = getRewardsDiscount(subtotal);
  const total = Math.max(0, subtotal - rewardsDiscount);

  return (
    <main className="min-h-screen bg-[#F4F4F1] px-4 py-6 pb-28">
      <div className="mx-auto max-w-2xl">
        <p className="text-[9px] font-black uppercase tracking-[.25em] text-[#E1352B]">Your bag</p>
        <h1 className="mt-1 text-3xl font-black">Shopping Cart</h1>
        {!items.length ? (
          <div className="mt-6 rounded-3xl bg-white p-8 text-center shadow-sm">
            <ShoppingBag className="mx-auto text-black/30" />
            <p className="mt-3 font-black">Your cart is empty</p>
            <Link href="/shop" className="mt-5 inline-flex rounded-full bg-[#14140F] px-5 py-3 text-xs font-black text-white">Browse Deals</Link>
          </div>
        ) : (
          <>
            <div className="mt-6 space-y-3">
              {items.map((item) => (
                <div key={String(item.id)} className="flex items-center gap-3 rounded-3xl bg-white p-3 shadow-sm">
                  <div className="min-w-0 flex-1"><p className="font-black text-sm">{item.name}</p><p className="text-xs text-black/40">Rs. {item.price.toLocaleString()}</p></div>
                  <div className="flex items-center rounded-xl bg-[#F4F4F1]"><button className="p-2" onClick={() => updateQty(item.id, item.qty - 1)}><Minus size={13}/></button><span className="w-6 text-center text-xs font-black">{item.qty}</span><button className="p-2" onClick={() => updateQty(item.id, item.qty + 1)}><Plus size={13}/></button></div>
                  <button className="p-2 text-[#E1352B]" onClick={() => removeItem(item.id)} aria-label="Remove item"><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
            <RewardsVoucherPanel subtotal={subtotal} />
            <div className="mt-5 rounded-3xl bg-white p-5 shadow-sm">
              <div className="flex justify-between text-sm font-bold text-black/45"><span>Subtotal</span><span>Rs. {subtotal.toLocaleString()}</span></div>
              {rewardsDiscount > 0 && <div className="mt-2 flex justify-between font-black text-[#0F6A5F]"><span>Rewards discount</span><span>- Rs. {rewardsDiscount.toLocaleString()}</span></div>}
              <div className="mt-3 flex justify-between border-t border-black/8 pt-3 text-lg font-black"><span>Total</span><span>Rs. {total.toLocaleString()}</span></div>
              <Link href="/checkout" className="mt-4 flex justify-center rounded-2xl bg-[#14140F] py-4 text-xs font-black text-white">Proceed to Checkout</Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
