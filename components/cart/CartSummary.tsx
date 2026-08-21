'use client';

import Link from 'next/link';
import { Check, LockKeyhole, RotateCcw, Tag, Truck } from 'lucide-react';
import CartTotals from './CartTotals';

export default function CartSummary({
  totalItems,
  subtotal,
  coupon,
  setCoupon,
  couponMessage,
  applyCoupon,
}: {
  totalItems: number;
  subtotal: number;
  coupon: string;
  setCoupon: (value: string) => void;
  couponMessage?: string;
  applyCoupon: () => void;
}) {
  return (
    <section className="rounded-[28px] border border-black/[0.06] bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.055)] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#E1352B]">Order summary</p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-[#14140F]">Bill Details</h2>
        </div>
        <span className="rounded-full bg-[#F7F7F5] px-3 py-2 text-[9px] font-black text-black/50">
          {totalItems} {totalItems === 1 ? 'item' : 'items'}
        </span>
      </div>

      <div className="mt-5 rounded-2xl bg-[#F7F7F5] p-3">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-black/35">
            <Tag size={16} />
          </div>
          <input
            value={coupon}
            onChange={(e) => setCoupon(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applyCoupon();
              }
            }}
            placeholder="Voucher / promo code"
            className="min-w-0 flex-1 bg-transparent px-1 text-xs font-bold outline-none placeholder:text-black/30"
            aria-label="Voucher or promo code"
          />
          <button
            type="button"
            onClick={applyCoupon}
            className="rounded-xl bg-[#14140F] px-3.5 py-2.5 text-[10px] font-black text-white transition-transform active:scale-95"
          >
            Apply
          </button>
        </div>
        {couponMessage && (
          <p className="mt-2 px-1 text-[9px] font-bold leading-4 text-black/45">{couponMessage}</p>
        )}
      </div>

      <div className="mt-5 rounded-2xl bg-[#F7F7F5] p-4">
        <CartTotals subtotal={subtotal} />
      </div>

      <Link
        href="/checkout"
        className="mt-5 flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#14140F] px-4 text-sm font-black text-white shadow-[0_8px_20px_rgba(0,0,0,0.16)] transition-transform active:scale-[0.99]"
      >
        Proceed to Checkout
      </Link>

      <Link
        href="/shop"
        className="mt-2 flex min-h-11 w-full items-center justify-center rounded-2xl border border-black/10 bg-white px-4 text-xs font-black text-[#14140F]"
      >
        Continue Shopping
      </Link>

      <div className="mt-5 grid grid-cols-3 divide-x divide-black/[0.08] border-t border-black/[0.08] pt-4">
        <div className="flex flex-col items-center gap-1 px-2 text-center">
          <Truck size={16} className="text-[#0F6A5F]" />
          <span className="text-[8px] font-black leading-3 text-black/50">COD Available</span>
        </div>
        <div className="flex flex-col items-center gap-1 px-2 text-center">
          <LockKeyhole size={16} className="text-[#0F6A5F]" />
          <span className="text-[8px] font-black leading-3 text-black/50">Secure Checkout</span>
        </div>
        <div className="flex flex-col items-center gap-1 px-2 text-center">
          <RotateCcw size={16} className="text-[#0F6A5F]" />
          <span className="text-[8px] font-black leading-3 text-black/50">Easy Returns</span>
        </div>
      </div>

      <p className="mt-4 flex items-center justify-center gap-1 text-center text-[8px] font-bold text-black/30">
        <Check size={11} /> Prices are based on your current cart items.
      </p>
    </section>
  );
}
