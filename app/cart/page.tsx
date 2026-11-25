'use client';

import Link from 'next/link';
import { ArrowLeft, ShoppingBag, Truck } from 'lucide-react';
import { useCartStore } from '@/lib/cartStore';
import CartItem from '@/components/cart/CartItem';
import CartSummary from '@/components/cart/CartSummary';
import { useCartQuote } from '@/components/cart/useCartQuote';

export default function CartPage() {
  const items = useCartStore(s => s.items);
  const updateQty = useCartStore(s => s.updateQty);
  const removeItem = useCartStore(s => s.removeItem);
  const itemCount = useCartStore(s => s.getCartCount());
  const itemsToFreeDelivery = useCartStore(s => s.getItemsToFreeDelivery());
  const deliveryProgress = useCartStore(s => s.getDeliveryProgress());
  const selection = useCartQuote(items);

  if (!items.length) return (
    <main className="min-h-[70vh] bg-[#F7F7F5] px-5 pb-28 pt-16">
      <div className="mx-auto max-w-sm rounded-3xl border border-black/5 bg-white px-6 py-10 text-center">
        <ShoppingBag size={36} className="mx-auto text-[#0F6A5F]"/>
        <h1 className="mt-5 text-2xl font-black tracking-tight">Your cart is empty</h1>
        <p className="mt-2 text-sm leading-6 text-black/50">Choose your products, size and quantity to get started.</p>
        <Link href="/shop" className="mt-6 flex min-h-12 items-center justify-center rounded-xl bg-[#0F6A5F] text-sm font-bold text-white">Start shopping</Link>
        <div id="cart-help-slot" className="mt-3"/>
      </div>
    </main>
  );

  return (
    <main className="min-h-screen bg-[#F7F7F5] px-3 pb-48 pt-5 text-[#18231F] sm:px-6 sm:pb-28 sm:pt-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/shop" aria-label="Back to shop" className="grid h-10 w-10 place-items-center rounded-full border border-black/5 bg-white"><ArrowLeft size={18}/></Link>
            <div><h1 className="text-xl font-black tracking-tight sm:text-2xl">My Cart <span className="ml-1 text-sm font-semibold text-black/40">({itemCount})</span></h1>
              <p className="mt-0.5 text-xs text-black/50">Check your items, then checkout.</p></div>
          </div>
          <Link href="/shop" className="text-right text-xs font-bold text-[#0F6A5F] underline underline-offset-4">Continue shopping</Link>
        </header>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section aria-label="Your cart items" className="min-w-0 space-y-3">
            <div className="rounded-xl border border-[#D9E8DF] bg-[#EDF6F0] px-3 py-3">
              <p className="flex items-center gap-2 text-xs font-bold text-[#17634F]"><Truck size={16} className="shrink-0"/>
                {selection.selfCollect ? 'Shop pickup is free' : itemsToFreeDelivery > 0 ? `Add ${itemsToFreeDelivery} more ${itemsToFreeDelivery === 1 ? 'item' : 'items'} for free delivery` : 'Free delivery unlocked'}</p>
              {!selection.selfCollect && <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#0F6A5F]/10"><div className="h-full rounded-full bg-[#0F6A5F] transition-[width]" style={{ width: `${deliveryProgress}%` }}/></div>}
            </div>
            {items.map(item => <CartItem key={String(item.id)} item={item} removeItem={removeItem} updateQty={updateQty} compact/>)}
          </section>

          <div className="min-w-0 lg:sticky lg:top-5">
            <CartSummary totalItems={itemCount} signedIn={selection.signedIn} quote={selection.quote as any}
              loading={selection.loading} quoteError={selection.quoteError} selfCollect={selection.selfCollect}
              setSelfCollect={selection.setSelfCollect} coupon={selection.voucherInput} setCoupon={selection.setVoucherInput}
              voucherCode={selection.voucherCode} applyCoupon={selection.applyVoucher} clearCoupon={selection.clearVoucher} retryQuote={selection.retryQuote}/>
          </div>
        </div>
      </div>

      <div data-cart-checkout-bar className="fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-30 border-t border-[#D9E3DC] bg-white/95 px-4 py-2.5 backdrop-blur-md sm:hidden">
        <div className="mx-auto flex max-w-md items-center justify-between gap-4">
          <div aria-live="polite"><p className="text-[10px] font-semibold text-black/50">Total to pay</p>
            <p className="text-lg font-black">{selection.loading ? 'Updating…' : selection.quote && !selection.quoteError ? `Rs. ${Number(selection.quote.total || 0).toLocaleString('en-PK')}` : 'Unavailable'}</p></div>
          {selection.quote && !selection.loading && !selection.quoteError
            ? <a href="/checkout" className="flex min-h-11 min-w-[148px] items-center justify-center rounded-xl bg-[#0F6A5F] px-5 text-sm font-bold text-white">Checkout →</a>
            : <button disabled className="min-h-11 min-w-[148px] rounded-xl bg-[#0F6A5F]/40 px-4 text-xs font-bold text-white">{selection.loading ? 'Updating total…' : 'Check total first'}</button>}
        </div>
      </div>
    </main>
  );
}
