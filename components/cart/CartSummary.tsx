'use client';

import Link from 'next/link';
import { Check, LockKeyhole, RotateCcw, Tag, Truck, ArrowRight } from 'lucide-react';
import CartTotals from './CartTotals';
import DeliveryOptions from '@/components/checkout/DeliveryOptions';

type CartQuote = {
  rawSubtotal: number;
  total: number;
  deliveryCharge: number;
  voucherDiscount?: number;
  voucherCashAmount?: number;
  cashbackEstimate?: number;
  cashbackPercent?: number;
  eligibleAfterVoucher?: number;
  resellerTier?: string;
  rewardLabel?: string;
  wholesaleItems?: number;
};

export default function CartSummary({
  totalItems, quote, loading, quoteError, selfCollect, setSelfCollect,
  coupon, setCoupon, applyCoupon, voucherCode,
}: {
  totalItems: number;
  quote: CartQuote | null;
  loading: boolean;
  quoteError: string;
  selfCollect: boolean;
  setSelfCollect: (value: boolean) => void;
  coupon: string;
  setCoupon: (value: string) => void;
  applyCoupon: () => void;
  voucherCode: string;
}) {
  const cashback = quote
    ? Math.min(Number(quote.eligibleAfterVoucher || 0),
      Number(quote.cashbackEstimate || 0) + Number(quote.voucherCashAmount || 0))
    : 0;
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

      <DeliveryOptions selfCollect={selfCollect} onChange={setSelfCollect} />

      <div className="mt-5 rounded-2xl bg-[#F7F7F5] p-3">
        <label htmlFor="cart-voucher" className="mb-2 block text-[10px] font-black text-[#0F6A5F]">
          Voucher / promo code
        </label>
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-black/35"><Tag size={16} /></div>
          <input
            id="cart-voucher"
            value={coupon}
            maxLength={24}
            onChange={(e) => setCoupon(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyCoupon(); } }}
            placeholder="Voucher / promo code"
            className="min-w-0 flex-1 bg-transparent px-1 text-xs font-bold uppercase outline-none placeholder:text-black/30"
          />
          <button type="button" onClick={applyCoupon} disabled={loading}
            className="rounded-xl bg-[#14140F] px-3.5 py-2.5 text-[10px] font-black text-white disabled:opacity-50">
            Apply
          </button>
        </div>
        {voucherCode && quote && !loading && <p role="status" className="mt-2 text-[10px] font-extrabold text-[#0F6A5F]">
          {Number(quote.voucherDiscount || 0) > 0
            ? `Rs. ${Number(quote.voucherDiscount).toLocaleString()} checkout discount applied.`
            : Number(quote.voucherCashAmount || 0) > 0
              ? `Rs. ${Number(quote.voucherCashAmount).toLocaleString()} cash wallet credit after Delivered.`
              : 'Voucher not applied.'}
        </p>}
        <p className="mt-2 text-[9px] leading-4 text-black/50">
          Big Deal and Weekly Deal products cannot receive voucher reductions or cashback.
        </p>
      </div>

      <div className="mt-5 rounded-2xl bg-[#F7F7F5] p-4" aria-live="polite">
        {loading ? <p className="py-5 text-center text-xs font-bold text-black/50">Verifying current prices and delivery…</p>
          : quote ? <CartTotals subtotal={Number(quote.rawSubtotal || 0)}
            deliveryCharge={Number(quote.deliveryCharge || 0)}
            total={Number(quote.total || 0)}
            discount={Number(quote.voucherDiscount || 0)}
            selfCollect={selfCollect} deliveryReward={quote.rewardLabel || ''} />
          : <p className="text-xs font-bold text-rose-600">Unable to verify totals right now.</p>}
      </div>
      {quoteError && <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{quoteError}</p>}

      {quote && !loading && (
        <div className="mt-4 rounded-2xl border border-[#0F6A5F]/20 bg-[#E9F6F2] px-4 py-3 text-xs text-[#0F6A5F]">
          {Number(quote.cashbackPercent || 0) > 0
            ? <><p className="font-black">{quote.resellerTier || 'Prime Family'} · {quote.cashbackPercent}% Cashback: Rs. {cashback.toLocaleString()}</p>
              <p className="mt-1 text-[10px] leading-5">Estimated reward goes to your withdrawable Cash Wallet only after Admin marks the order <b>Delivered</b>. No cashback applies to deal products.</p></>
            : <><p className="font-black">{cashback > 0 ? `Estimated Cash Wallet reward Rs. ${cashback.toLocaleString()}` : 'Prime Family cashback available for signed-in eligible members'}</p>
              <p className="mt-1 text-[10px] leading-5">Starter tier begins at 5% for eligible regular products. Confirmed rewards are credited after delivery, not deducted from today’s bill.</p></>}
        </div>
      )}

      {quote && !loading ? (
        <Link href="/checkout"
          className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#14140F] px-4 text-sm font-black text-white shadow-[0_8px_20px_rgba(0,0,0,0.16)]">
          Continue to Payment & Delivery Details <ArrowRight size={16}/>
        </Link>
      ) : (
        <button type="button" disabled className="mt-5 flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#14140F]/40 text-xs font-bold text-white">
          {loading ? 'Checking your order…' : 'Verify order to continue'}
        </button>
      )}

      <div className="mt-5 grid grid-cols-3 divide-x divide-black/[0.08] border-t border-black/[0.08] pt-4">
        <div className="flex flex-col items-center gap-1 px-2 text-center"><Truck size={16} className="text-[#0F6A5F]"/><span className="text-[8px] font-black leading-3 text-black/50">COD Available</span></div>
        <div className="flex flex-col items-center gap-1 px-2 text-center"><LockKeyhole size={16} className="text-[#0F6A5F]"/><span className="text-[8px] font-black leading-3 text-black/50">Secure Checkout</span></div>
        <div className="flex flex-col items-center gap-1 px-2 text-center"><RotateCcw size={16} className="text-[#0F6A5F]"/><span className="text-[8px] font-black leading-3 text-black/50">Easy Returns</span></div>
      </div>
      <p className="mt-4 flex items-center justify-center gap-1 text-center text-[8px] font-bold text-black/30">
        <Check size={11}/> Final charges verified again securely at order submission.
      </p>
    </section>
  );
}
