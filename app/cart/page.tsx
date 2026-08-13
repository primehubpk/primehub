'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  LockKeyhole,
  Minus,
  Plus,
  RotateCcw,
  ShoppingBag,
  Tag,
  Trash2,
  Truck,
} from 'lucide-react';
import { useCartStore } from '@/lib/cartStore';

function CartThumbnail({ src, alt }: { src?: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-[#F4F4F1] sm:h-24 sm:w-24">
      {src && !failed ? (
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-black/20" aria-label="Product image unavailable">
          <ShoppingBag size={24} />
        </div>
      )}
    </div>
  );
}

export default function CartPage() {
  const items = useCartStore((s) => s.items);
  const updateQty = useCartStore((s) => s.updateQty);
  const removeItem = useCartStore((s) => s.removeItem);
  const subtotal = useCartStore((s) => s.getSubtotal());
  const itemCount = useCartStore((s) => s.getCartCount());
  const itemsToFreeDelivery = useCartStore((s) => s.getItemsToFreeDelivery());
  const deliveryProgress = useCartStore((s) => s.getDeliveryProgress());
  const [coupon, setCoupon] = useState('');
  const [couponMessage, setCouponMessage] = useState('');

  const applyCoupon = () => {
    if (!coupon.trim()) {
      setCouponMessage('Enter a promo code first.');
      return;
    }
    setCouponMessage('Promo codes are not currently configured. Your cart total is unchanged.');
  };

  if (!items.length) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F4F4F1] px-4 pb-24">
        <div className="w-full max-w-md rounded-[32px] bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#F4F4F1]">
            <ShoppingBag size={26} className="text-black/30" />
          </div>
          <p className="mt-5 text-[9px] font-black uppercase tracking-[0.25em] text-[#E1352B]">Your bag</p>
          <h1 className="mt-2 text-2xl font-black">Your Shopping Bag is Empty</h1>
          <p className="mt-2 text-sm leading-6 text-black/45">Find something you love and add it to your cart.</p>
          <Link href="/shop" className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-[#14140F] py-4 text-xs font-black text-white">
            Start Shopping
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F4F4F1] px-4 py-5 pb-28 sm:py-7">
      <div className="mx-auto max-w-6xl">
        <Link href="/shop" className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm" aria-label="Back to shop">
          <ArrowLeft size={17} />
        </Link>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
          <section>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[#E1352B]">Your bag</p>
                <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Shopping Cart</h1>
              </div>
              <span className="rounded-full bg-white px-3 py-2 text-[10px] font-black text-black/45 shadow-sm">
                {itemCount} {itemCount === 1 ? 'ITEM' : 'ITEMS'}
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {items.map((item) => {
                const lineTotal = item.price * item.qty;
                const image = item.image || item.imageUrl;

                return (
                  <article key={String(item.id)} className="rounded-[26px] bg-white p-3 shadow-sm sm:p-4">
                    <div className="flex gap-3 sm:gap-4">
                      <CartThumbnail src={image} alt={item.name} />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h2 className="line-clamp-2 text-sm font-black leading-5 sm:text-base">{item.name}</h2>
                            <p className="mt-1 text-[11px] font-bold text-black/45">Rs. {item.price.toLocaleString()} each</p>
                            {item.dealDay && item.originalPrice > item.price && (
                              <span className="mt-2 inline-flex rounded-full bg-[#E1352B]/10 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-[#E1352B]">
                                Deal Price
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#E1352B] hover:bg-[#E1352B]/10"
                            aria-label={`Remove ${item.name}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-wider text-black/35">Quantity</p>
                            <div className="mt-1 flex items-center rounded-xl bg-[#F4F4F1]">
                              <button
                                type="button"
                                onClick={() => updateQty(item.id, item.qty - 1)}
                                className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-black/5"
                                aria-label={`Decrease ${item.name} quantity`}
                              >
                                <Minus size={14} />
                              </button>
                              <span className="w-8 text-center text-xs font-black">{item.qty}</span>
                              <button
                                type="button"
                                onClick={() => updateQty(item.id, item.qty + 1)}
                                className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-black/5"
                                aria-label={`Increase ${item.name} quantity`}
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          </div>

                          <div className="text-right">
                            <p className="text-[9px] font-black uppercase tracking-wider text-black/35">Item Subtotal</p>
                            <p className="mt-1 font-[family-name:var(--font-mono)] text-base font-black">Rs. {item.price.toLocaleString()} × {item.qty} = Rs. {lineTotal.toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <Link href="/shop" className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-3 text-[10px] font-black shadow-sm">
              <ArrowLeft size={13} /> Continue Shopping
            </Link>
          </section>

          <aside className="h-fit rounded-[28px] bg-white p-5 shadow-sm lg:sticky lg:top-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#E1352B]">Order summary</p>
                <h2 className="mt-1 text-xl font-black">Your Total</h2>
              </div>
              <span className="rounded-full bg-[#F4F4F1] px-3 py-2 text-[9px] font-black">{itemCount} items</span>
            </div>

            <div className="mt-5 rounded-2xl bg-[#F4F4F1] p-3">
              <div className="flex gap-2">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-black/35"><Tag size={16} /></div>
                <input
                  value={coupon}
                  onChange={(e) => { setCoupon(e.target.value); setCouponMessage(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyCoupon(); } }}
                  placeholder="Promo code / coupon"
                  className="min-w-0 flex-1 bg-transparent px-1 text-xs font-bold outline-none placeholder:text-black/30"
                  aria-label="Promo code or coupon"
                />
                <button type="button" onClick={applyCoupon} className="rounded-xl bg-[#14140F] px-3 text-[10px] font-black text-white">Apply</button>
              </div>
              {couponMessage && <p className="mt-2 px-1 text-[9px] font-bold leading-4 text-black/45">{couponMessage}</p>}
            </div>

            <div className="mt-5 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-bold text-black/50">Subtotal</span>
                <span className="font-[family-name:var(--font-mono)] font-black">Rs. {subtotal.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-black/50">Shipping</span>
                <span className="text-xs font-black text-black/55">Calculated at Checkout</span>
              </div>
              <div className="h-px bg-black/8" />
              <div className="flex items-end justify-between gap-3">
                <span className="font-black">Total</span>
                <span className="font-[family-name:var(--font-mono)] text-2xl font-black">Rs. {subtotal.toLocaleString()}</span>
              </div>
            </div>

            {itemsToFreeDelivery > 0 ? (
              <div className="mt-5 rounded-2xl bg-[#0F6A5F]/8 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[9px] font-black leading-4 text-[#0F6A5F]">Add {itemsToFreeDelivery} more {itemsToFreeDelivery === 1 ? 'item' : 'items'} to unlock FREE DELIVERY</p>
                  <span className="shrink-0 text-[9px] font-black text-[#0F6A5F]">{deliveryProgress}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#0F6A5F]/10">
                  <div className="h-full rounded-full bg-[#0F6A5F] transition-all" style={{ width: `${deliveryProgress}%` }} />
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl bg-[#0F6A5F]/8 p-3 text-[9px] font-black text-[#0F6A5F]">✓ FREE DELIVERY unlocked</div>
            )}

            <Link href="/checkout" className="mt-5 flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#14140F] px-4 text-sm font-black text-white shadow-lg shadow-black/10">
              Proceed to Checkout
            </Link>
            <Link href="/shop" className="mt-2 flex min-h-12 w-full items-center justify-center rounded-2xl border border-black/10 bg-white px-4 text-xs font-black text-black">
              Continue Shopping
            </Link>

            <div className="mt-5 grid grid-cols-3 divide-x divide-black/8 border-t border-black/8 pt-4">
              <div className="flex flex-col items-center gap-1 px-2 text-center"><Truck size={16} className="text-[#0F6A5F]" /><span className="text-[8px] font-black leading-3 text-black/50">COD Available</span></div>
              <div className="flex flex-col items-center gap-1 px-2 text-center"><LockKeyhole size={16} className="text-[#0F6A5F]" /><span className="text-[8px] font-black leading-3 text-black/50">Secure Checkout</span></div>
              <div className="flex flex-col items-center gap-1 px-2 text-center"><RotateCcw size={16} className="text-[#0F6A5F]" /><span className="text-[8px] font-black leading-3 text-black/50">Easy Returns</span></div>
            </div>

            <p className="mt-4 flex items-center justify-center gap-1 text-center text-[8px] font-bold text-black/30"><Check size={11} /> Prices are based on your current cart items.</p>
          </aside>
        </div>
      </div>
    </main>
  );
}
