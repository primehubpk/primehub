'use client';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, ShoppingBag, Star } from 'lucide-react';
import { useCheckout } from '@/components/checkout/useCheckout';
import CustomerForm from '@/components/checkout/CustomerForm';
import CheckoutActions from '@/components/checkout/CheckoutActions';

export default function CheckoutPage(){
  const c=useCheckout();
  if(c.orderId)return <main className="flex min-h-screen items-center justify-center bg-[#F4F4F1] px-4"><div className="w-full max-w-md rounded-[30px] bg-white p-7 text-center shadow-xl"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#0F6A5F]/10 text-[#0F6A5F]"><CheckCircle2 size={30}/></div><p className="mt-5 text-[9px] font-black uppercase tracking-[0.25em] text-[#0F6A5F]">Order received</p><h1 className="mt-2 text-2xl font-black">Thank you! 🎉</h1><p className="mt-2 text-xs leading-5 text-black/45">Your order has been saved. Our team will contact you to confirm the delivery details.</p><div className="mt-5 rounded-2xl bg-[#F4F4F1] p-4 text-left"><p className="text-[9px] font-black uppercase tracking-wider text-black/35">Order ID</p><p className="mt-1 break-all font-[family-name:var(--font-mono)] text-xs font-black">{c.orderId}</p></div>{c.walletPaidReceipt > 0 && <div className="mt-3 rounded-2xl bg-[#DDF5F0] p-4 text-left text-xs font-black text-[#0F6A5F]"><p>Total cash wallet paid: Rs. {c.walletPaidReceipt.toLocaleString()}</p><p className="mt-2">Remaining to pay on delivery: Rs. {c.amountDueReceipt.toLocaleString()}</p></div>}{c.reviewProductIds.length>0&&<div className="mt-4 rounded-2xl border border-[#FFB020]/25 bg-[#FFB020]/10 p-4 text-left"><div className="flex items-center gap-2"><Star size={16} className="text-[#FFB020]" fill="currentColor"/><p className="text-xs font-black">Rate your order</p></div><p className="mt-1 text-[10px] font-bold leading-4 text-black/45">Only products from this verified order can be rated.</p><div className="mt-3 flex flex-wrap gap-2">{c.reviewProductIds.map((productId,index)=><Link key={`${productId}-${index}`} href={`/product/${encodeURIComponent(productId)}`} className="rounded-xl bg-white px-3 py-2 text-[10px] font-black shadow-sm">Rate product {c.reviewProductIds.length>1?index+1:''}</Link>)}</div></div>}<Link href="/" className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-[#14140F] py-4 text-xs font-black text-white">Continue Shopping</Link></div></main>;
  if(!c.items.length)return <main className="flex min-h-screen items-center justify-center bg-[#F4F4F1] px-4"><div className="w-full max-w-md rounded-[30px] bg-white p-7 text-center shadow-xl"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F4F4F1]"><ShoppingBag size={22} className="text-black/30"/></div><h1 className="mt-4 text-lg font-black">Your cart is empty</h1><p className="mt-1 text-xs text-black/40">Add a deal before heading to checkout.</p><Link href="/shop" className="mt-5 inline-flex rounded-full bg-[#14140F] px-5 py-3 text-[10px] font-black text-white">Browse Deals</Link></div></main>;
  return (
    <main className="min-h-screen bg-[#F4F4F1] pb-28">
      <div className="mx-auto max-w-2xl px-4 py-5 md:px-6">
        <Link href="/cart" className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm" aria-label="Back to cart"><ArrowLeft size={17}/></Link>
        <form onSubmit={c.placeOrder} className="mt-4 rounded-[28px] bg-white p-5 shadow-sm md:p-7">
          <p className="text-[9px] font-black uppercase tracking-[0.23em] text-[#E1352B]">Secure Checkout</p>
          <h1 className="mt-1 text-2xl font-black">{c.selfCollect ? 'Your Shop Pickup Details' : 'Your Delivery & Payment Details'}</h1>
          <p className="mt-1 text-xs leading-5 text-black/45">Your delivery choice, promo code and bill were already set in Cart. Complete your contact details to place the order.</p>

          {c.error && <div role="alert" className="mt-4 rounded-2xl bg-[#E1352B]/10 p-3 text-xs font-bold text-[#E1352B]">{c.error}</div>}
          {c.voucherError && <div role="alert" className="mt-3 rounded-2xl bg-rose-50 p-3 text-xs font-bold text-rose-600">{c.voucherError}</div>}
          {c.walletBalanceStatus === 'loading' && <p role="status" className="mt-4 rounded-xl bg-[#DDF5F0] p-3 text-xs text-[#0F6A5F]">Checking available wallet balance…</p>}
          {c.walletBalanceStatus === 'unavailable' && <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-700">Wallet is temporarily unavailable. Please refresh before ordering.</p>}

          <div className="mt-5 rounded-[22px] border border-[#0F6A5F]/20 bg-[#EAF7F3] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-black text-[#0F6A5F]">Payment Overview</h2>
              <Link href="/cart" className="rounded-full bg-white px-3 py-1.5 text-[10px] font-extrabold text-[#0F6A5F]">Edit in Cart →</Link>
            </div>
            <p className="mt-1 text-[10px] text-[#0F6A5F]">{c.selfCollect ? '🏪 Shop pickup · free delivery' : '🚚 Home delivery'}{c.voucherCode ? ` · Voucher: ${c.voucherCode}` : ''}</p>
            {!c.walletCheckoutReady ? (
              <p className="mt-3 text-xs font-bold">Checking current payment amount…</p>
            ) : (
              <div className="mt-3 space-y-2 text-xs font-bold text-[#14140F]">
                <div className="flex justify-between gap-2"><span>Products</span><span>Rs. {c.rawSubtotal.toLocaleString()}</span></div>
                {c.voucherDiscount > 0 && <div className="flex justify-between gap-2 text-[#0F6A5F]"><span>Voucher savings</span><span>- Rs. {c.voucherDiscount.toLocaleString()}</span></div>}
                <div className="flex justify-between gap-2"><span>Shipping</span><span>{c.deliveryCharge === 0 ? 'FREE' : `Rs. ${c.deliveryCharge.toLocaleString()}`}</span></div>
                {c.walletShoppingApplied > 0 && <div className="flex justify-between gap-2 text-[#0F6A5F]"><span>Applied Wallet Balance</span><span>- Rs. {c.walletShoppingApplied.toLocaleString()}</span></div>}
                <div className="flex justify-between gap-2 border-t border-[#0F6A5F]/20 pt-3 text-sm font-black">
                  <span>Amount to pay</span><span>Rs. {c.amountDue.toLocaleString()}</span>
                </div>
              </div>
            )}
            {c.voucherKind === 'referral' && c.walletCheckoutReady && (
              <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-[11px] font-bold text-[#0F6A5F]">Friend invitation code applied: {c.referralPercent}% (estimated Rs. {c.referralCashEstimate.toLocaleString()}) will go to the code OWNER once your qualifying order is Delivered. Your own tier cashback does NOT stack on this order. No discount is taken from your bill.</p>
            )}
            {(c.voucherKind === 'cashback' || c.voucherKind === 'cash') && c.walletCheckoutReady && (
              <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-[11px] font-bold text-[#0F6A5F]">Promo cashback instead of tier, not additional: {c.voucherKind === 'cashback' ? String(c.voucherCashbackPercent) + '%; ' : 'fixed amount; '}Rs. {c.voucherCashAmount.toLocaleString()} after delivery.</p>
            )}
            {(c.cashbackPercent > 0 || c.voucherCashAmount > 0) && c.walletCheckoutReady && (
              <div className="mt-3 rounded-xl bg-white px-3 py-3 text-xs font-bold text-[#0F6A5F]">
                🎁 {c.voucherKind === 'cashback' ? 'Cashback promo ' + c.voucherCashbackPercent + '% (instead of tier)' : c.voucherKind === 'cash' ? 'Cash voucher (instead of tier)' : (c.resellerTier || 'Prime Family') + ' ' + c.cashbackPercent + '% cashback'} · Estimated withdrawable Cash Wallet credit Rs. {Math.min(c.eligibleAfterVoucher, c.cashbackEstimate + c.voucherCashAmount).toLocaleString()}
                <p className="mt-1 text-[10px] font-medium leading-4 text-black/60">Credited only when Admin marks this order Delivered. Weekly/Big Deals excluded. No deduction from checkout bill.</p>
              </div>
            )}
            {c.cashbackPercent === 0 && !c.voucherKind && c.walletCheckoutReady && (
              <p className="mt-3 text-[10px] text-[#0F6A5F]">Prime Family Starter cashback starts at 5% for active signed-in members on eligible products.</p>
            )}
          </div>
          <CustomerForm customer={c.customer} update={c.update} selfCollect={c.selfCollect}/>
          <CheckoutActions placing={c.placing} walletCheckoutReady={c.walletCheckoutReady} whatsappOrder={c.whatsappOrder}/>
        </form>
      </div>
    </main>
  );
}
