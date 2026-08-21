'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ShoppingBag } from 'lucide-react';
import { useCartStore } from '@/lib/cartStore';
import CartItem from '@/components/cart/CartItem';
import CartSummary from '@/components/cart/CartSummary';

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
      <main className="min-h-screen bg-[#F7F7F5] px-4 pb-28 pt-5 sm:pt-7">
        <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-md items-center justify-center">
          <div className="w-full rounded-[30px] border border-black/[0.06] bg-white p-8 text-center shadow-[0_8px_30px_rgba(0,0,0,0.05)]">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#F7F7F5]">
              <ShoppingBag size={26} className="text-black/30" />
            </div>
            <p className="mt-5 text-[9px] font-black uppercase tracking-[0.25em] text-[#E1352B]">Your cart</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight">Your Shopping Bag is Empty</h1>
            <p className="mt-2 text-sm leading-6 text-black/45">Find something you love and add it to your cart.</p>
            <Link
              href="/shop"
              className="mt-6 flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#14140F] py-4 text-xs font-black text-white shadow-[0_8px_20px_rgba(0,0,0,0.14)]"
            >
              Start Shopping
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F7F7F5] pb-28">
      <header className="sticky top-0 z-30 border-b border-black/[0.06] bg-[#F7F7F5]/95 px-4 py-3 backdrop-blur-md sm:py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <Link
            href="/shop"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm"
            aria-label="Back to shop"
          >
            <ArrowLeft size={17} />
          </Link>

          <div className="min-w-0 text-center">
            <h1 className="text-base font-black tracking-tight text-[#14140F] sm:text-lg">My Cart</h1>
            <p className="text-[9px] font-bold text-black/40">
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </p>
          </div>

          <Link href="/shop" className="px-1 text-[10px] font-black text-black/45">
            Edit
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-5 sm:py-7">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_390px] lg:items-start lg:gap-6">
          <section>
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.24em] text-[#E1352B]">Your items</p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-[#14140F] sm:text-3xl">Shopping Cart</h2>
              </div>
              <span className="rounded-full bg-white px-3 py-2 text-[9px] font-black text-black/45 shadow-sm">
                {itemCount} {itemCount === 1 ? 'ITEM' : 'ITEMS'}
              </span>
            </div>

            <div className="space-y-3">
              {items.map((item) => (
                <CartItem
                  key={String(item.id)}
                  item={item}
                  removeItem={removeItem}
                  updateQty={updateQty}
                />
              ))}
            </div>

            <Link
              href="/shop"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-3 text-[10px] font-black text-[#14140F] shadow-sm"
            >
              <ArrowLeft size={13} /> Continue Shopping
            </Link>
          </section>

          <aside className="space-y-4 lg:sticky lg:top-[76px]">
            <section className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-[0_4px_18px_rgba(0,0,0,0.045)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#0F6A5F]">Delivery</p>
                  <h2 className="mt-1 text-sm font-black text-[#14140F]">
                    {itemsToFreeDelivery > 0
                      ? `Add ${itemsToFreeDelivery} more ${itemsToFreeDelivery === 1 ? 'item' : 'items'} for FREE DELIVERY`
                      : 'FREE DELIVERY unlocked'}
                  </h2>
                </div>
                <span className="text-[9px] font-black text-[#0F6A5F]">{deliveryProgress}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#0F6A5F]/10">
                <div
                  className="h-full rounded-full bg-[#0F6A5F] transition-all duration-300"
                  style={{ width: `${deliveryProgress}%` }}
                />
              </div>
            </section>

            <CartSummary
              totalItems={itemCount}
              subtotal={subtotal}
              coupon={coupon}
              setCoupon={(value) => {
                setCoupon(value);
                setCouponMessage('');
              }}
              couponMessage={couponMessage}
              applyCoupon={applyCoupon}
            />
          </aside>
        </div>
      </div>
    </main>
  );
}
