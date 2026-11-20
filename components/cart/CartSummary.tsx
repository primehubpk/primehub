'use client';

import Link from 'next/link';
import { ArrowRight, ChevronDown, Store, Truck } from 'lucide-react';
import CartTotals from './CartTotals';
import PrimeFamilyCartCard, { type CashbackTier } from './PrimeFamilyCartCard';

type CartQuote = {
  rawSubtotal: number; total: number; deliveryCharge: number; voucherDiscount?: number;
  voucherCashAmount?: number; voucherCashbackPercent?: number; referralPercent?: number;
  referralCashEstimate?: number; buyerReferralCashEstimate?: number; referralIsOwnCode?: boolean;
  voucherKind?: string; tierCashbackPercent?: number; cashbackEstimate?: number; cashbackPercent?: number;
  cashbackMemberActive?: boolean; cashbackTiers?: CashbackTier[]; eligibleAfterVoucher?: number;
  resellerTier?: string; rewardLabel?: string; wholesaleItems?: number;
};

export default function CartSummary({ totalItems, quote, loading, quoteError, selfCollect, setSelfCollect,
  coupon, setCoupon, applyCoupon, clearCoupon, retryQuote, voucherCode, signedIn,
}: {
  totalItems: number; quote: CartQuote | null; loading: boolean; quoteError: string;
  selfCollect: boolean; setSelfCollect: (value: boolean) => void;
  coupon: string; setCoupon: (value: string) => void; applyCoupon: () => void;
  clearCoupon: () => void; retryQuote: () => void; voucherCode: string; signedIn: boolean;
}) {
  const ready = Boolean(quote && !loading && !quoteError);
  return <section aria-label="Order summary" className="rounded-2xl border border-[#E4E8E1] bg-white p-4">
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-base font-black">Order total</h2>
      <span className="text-xs text-black/45">{totalItems} {totalItems === 1 ? 'item' : 'items'}</span>
    </div>

    <fieldset className="mb-4">
      <legend className="mb-2 text-xs font-bold text-black/65">How would you like your order?</legend>
      <div className="grid grid-cols-2 gap-2">
        {[false, true].map(pickup => <label key={String(pickup)} className={`flex cursor-pointer items-start gap-2 rounded-xl border px-2.5 py-3 ${selfCollect === pickup ? 'border-[#0F6A5F] bg-[#F0F7F2]' : 'border-[#E4E8E1] bg-white'}`}>
          <input type="radio" name="cart-delivery" value={pickup ? 'pickup' : 'delivery'} checked={selfCollect === pickup} onChange={() => setSelfCollect(pickup)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#0F6A5F]"/>
          <span className="min-w-0"><span className="flex items-center gap-1 text-[11px] font-bold">{pickup ? <Store size={13}/> : <Truck size={13}/>} {pickup ? 'Shop pickup' : 'Home delivery'}</span>
            <span className="mt-1 block text-[10px] leading-4 text-black/50">{pickup ? 'Free · collect from shop' : 'Delivery fee shown below'}</span></span>
        </label>)}
      </div>
    </fieldset>

    <details className="mb-4 rounded-xl border border-[#E4E8E1] px-3 py-2.5" open={Boolean(voucherCode || quoteError) || undefined}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-semibold"><span>Promo or friend code <span className="font-normal text-black/40">(optional)</span></span><ChevronDown size={14}/></summary>
      <div className="mt-3 flex gap-2">
        <label htmlFor="cart-voucher" className="sr-only">Promo or friend code</label>
        <input id="cart-voucher" value={coupon} maxLength={24} onChange={event => setCoupon(event.target.value.toUpperCase())}
          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); applyCoupon(); } }}
          placeholder="Enter code" className="h-10 min-w-0 flex-1 rounded-lg border border-black/10 bg-[#FAFBF8] px-3 text-xs font-semibold uppercase outline-[#0F6A5F]"/>
        <button type="button" onClick={applyCoupon} disabled={loading} className="rounded-lg bg-[#0F6A5F] px-3 text-xs font-bold text-white disabled:opacity-40">Apply</button>
      </div>
      <p className="mt-2 text-[10px] leading-4 text-black/50">Use one code or your Family tier benefit. Cashback is credited after delivery.</p>
      {voucherCode && <button type="button" onClick={clearCoupon} className="mt-1 min-h-8 text-[11px] font-bold text-[#0F6A5F] underline underline-offset-2">Remove code</button>}
      {ready && voucherCode && quote && <p role="status" className="mt-2 text-[11px] font-semibold leading-4 text-[#0F6A5F]">
        {quote.voucherKind === 'discount' && Number(quote.voucherDiscount) > 0
          ? `Rs. ${Number(quote.voucherDiscount).toLocaleString('en-PK')} discount applied.`
          : quote.voucherKind === 'referral'
            ? `You earn Rs. ${Number(quote.buyerReferralCashEstimate || 0).toLocaleString('en-PK')} after delivery. ${quote.referralIsOwnCode ? 'Your own code credits once.' : 'The code owner earns cashback too.'}`
            : quote.voucherKind === 'cash' || quote.voucherKind === 'cashback'
              ? `Rs. ${Number(quote.voucherCashAmount || 0).toLocaleString('en-PK')} shopping credit after delivery, replacing tier cashback.` : 'Code not applied.'}
      </p>}
    </details>

    <div aria-live="polite" className="border-t border-black/5 pt-3">
      {loading ? <p className="py-4 text-xs text-black/50">Updating prices and delivery…</p>
        : quote && !quoteError ? <CartTotals subtotal={Number(quote.rawSubtotal || 0)} deliveryCharge={Number(quote.deliveryCharge || 0)} total={Number(quote.total || 0)}
          discount={Number(quote.voucherDiscount || 0)} selfCollect={selfCollect} deliveryReward={quote.rewardLabel || ''}/>
          : <p className="text-xs font-semibold text-rose-700">We could not check your total.</p>}
    </div>
    {quoteError && <div role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-700"><p>{quoteError}</p>
      <button type="button" onClick={retryQuote} disabled={loading} className="mt-2 min-h-9 rounded-lg border border-rose-200 px-3 font-bold">Retry total</button></div>}

    {ready ? <Link href="/checkout" className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#0F6A5F] text-sm font-bold text-white">Checkout <ArrowRight size={16}/></Link>
      : <button type="button" disabled className="mt-4 min-h-12 w-full rounded-xl bg-[#0F6A5F]/40 text-xs font-bold text-white">{loading ? 'Updating total…' : 'Check total first'}</button>}
    <p className="mt-2 text-center text-[10px] text-black/45">Address and payment on the next step.</p>

    {ready && quote && <details className="mt-4 border-t border-black/5 pt-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-bold text-[#0F6A5F]">Cashback &amp; Prime Family <ChevronDown size={14}/></summary>
      <PrimeFamilyCartCard signedIn={signedIn} activeMember={quote.cashbackMemberActive === true}
        tierName={String(quote.resellerTier || '')} cashbackPercent={Number(quote.cashbackPercent || 0)} tierCashbackPercent={Number(quote.tierCashbackPercent || 0)}
        voucherCashbackPercent={Number(quote.voucherCashbackPercent || 0)} voucherKind={String(quote.voucherKind || '')}
        referralPercent={Number(quote.referralPercent || 0)} referralCashEstimate={Number(quote.referralCashEstimate || 0)}
        buyerReferralCashEstimate={Number(quote.buyerReferralCashEstimate || 0)} referralIsOwnCode={quote.referralIsOwnCode === true}
        cashbackEstimate={Number(quote.cashbackEstimate || 0)} eligibleSubtotal={Number(quote.eligibleAfterVoucher || 0)}
        voucherCashAmount={Number(quote.voucherCashAmount || 0)} tiers={Array.isArray(quote.cashbackTiers) ? quote.cashbackTiers : []}/>
    </details>}
  </section>;
}
