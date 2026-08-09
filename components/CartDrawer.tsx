'use client';

import Link from 'next/link';

import { useEffect, useMemo } from 'react';
import { Minus, Plus, ShoppingBag, Trash2, X, Truck, MessageCircle } from 'lucide-react';
import { useCartStore } from '@/lib/cartStore';
import { useSettings } from '@/lib/useSettings';

const FALLBACK_THRESHOLD = 5;

function productTitle(item: any) {
  return item.title || item.name || 'Product';
}

function productImage(item: any) {
  return item.imageUrl || item.image || item.images?.[0] || '';
}

function productPrice(item: any) {
  return Number(item.price || 0);
}

export default function CartDrawer() {
  const { settings } = useSettings();
  const isOpen = useCartStore((state: any) => Boolean(state.isDrawerOpen));
  const closeDrawer = useCartStore((state: any) => state.closeDrawer);
  const items = useCartStore((state: any) => state.items || state.cart || []);
  const removeItem = useCartStore((state) => state.removeItem);
  const updateQty = useCartStore((state) => state.updateQty);
  const clearCart = useCartStore((state: any) => state.clearCart);

  const threshold = Math.max(
    1,
    Number(settings.freeDelivery?.itemThreshold || FALLBACK_THRESHOLD)
  );

  const totalItems = useMemo(
    () =>
      items.reduce(
        (sum: number, item: any) => sum + Number(item.quantity || item.qty || 1),
        0
      ),
    [items]
  );

  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum: number, item: any) =>
          sum +
          productPrice(item) * Number(item.quantity || item.qty || 1),
        0
      ),
    [items]
  );

  const progress = Math.min(100, Math.round((totalItems / threshold) * 100));
  const remaining = Math.max(0, threshold - totalItems);
  const freeDeliveryEnabled = settings.freeDelivery?.enabled !== false;

  const message = remaining > 0
    ? String(settings.freeDelivery?.message || 'Add {remaining} more item{plural} to unlock FREE DELIVERY')
        .replace('{remaining}', String(remaining))
        .replace('{plural}', remaining === 1 ? '' : 's')
    : String(settings.freeDelivery?.unlockedMessage || 'FREE DELIVERY UNLOCKED 🎉');

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sendWhatsApp = () => {
    const lines = items.map((item: any, index: number) => {
      const qty = Number(item.quantity || item.qty || 1);
      return `${index + 1}. ${productTitle(item)} × ${qty} — Rs. ${(productPrice(item) * qty).toLocaleString()}`;
    });

    const text = [
      '🛍️ PrimeHub Deals Order',
      '',
      ...lines,
      '',
      `Total Items: ${totalItems}`,
      `Subtotal: Rs. ${subtotal.toLocaleString()}`,
      '',
      'I want to place this order via WhatsApp.',
    ].join('\n');

    window.open(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  return (
    <div className="fixed inset-0 z-[100]">
      <button
        type="button"
        aria-label="Close cart"
        onClick={closeDrawer}
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
      />

      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-[#F4F4F1] shadow-2xl">
        <header className="flex items-center justify-between border-b border-black/8 bg-white px-5 py-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#E1352B]">
              Your bag
            </p>
            <h2 className="mt-0.5 text-xl font-black text-[#14140F]">
              Shopping Cart
            </h2>
          </div>
          <button
            type="button"
            onClick={closeDrawer}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F4F4F1]"
            aria-label="Close cart"
          >
            <X size={18} />
          </button>
        </header>

        {freeDeliveryEnabled && (
          <div className="border-b border-black/8 bg-white px-5 py-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#0F6A5F]/10 text-[#0F6A5F]">
                  <Truck size={15} />
                </span>
                <p className="text-[11px] font-black text-[#14140F]">{message}</p>
              </div>
              <span className="text-[10px] font-black text-black/40">
                {Math.min(totalItems, threshold)}/{threshold}
              </span>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-black/8">
              <div
                className="h-full rounded-full bg-[#0F6A5F] transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white shadow-sm">
                <ShoppingBag size={25} className="text-black/30" />
              </div>
              <h3 className="mt-4 text-base font-black">Your cart is empty</h3>
              <p className="mt-1 max-w-[240px] text-xs leading-5 text-black/45">
                Add something you love and your products will appear here.
              </p>
              <button
                type="button"
                onClick={closeDrawer}
                className="mt-5 rounded-full bg-[#14140F] px-5 py-2.5 text-[10px] font-black text-white"
              >
                Continue Shopping
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item: any) => {
                const qty = Number(item.quantity || item.qty || 1);
                const price = productPrice(item);
                const id = item.id || item.productId;

                return (
                  <div
                    key={id}
                    className="rounded-[22px] border border-black/7 bg-white p-3 shadow-sm"
                  >
                    <div className="flex gap-3">
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-[#F4F4F1]">
                        {productImage(item) && (
                          <img
                            src={productImage(item)}
                            alt={productTitle(item)}
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-xs font-black text-[#14140F]">
                          {productTitle(item)}
                        </p>
                        <p className="mt-1 font-[family-name:var(--font-mono)] text-sm font-black text-[#E1352B]">
                          Rs. {price.toLocaleString()}
                        </p>

                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="flex items-center rounded-xl bg-[#F4F4F1]">
                            <button
                              type="button"
                              onClick={() => {
                                if (qty <= 1) removeItem(id);
                                else updateQty(id, qty - 1);
                              }}
                              className="flex h-8 w-8 items-center justify-center"
                              aria-label="Decrease quantity"
                            >
                              <Minus size={13} />
                            </button>
                            <span className="w-7 text-center text-[11px] font-black">{qty}</span>
                            <button
                              type="button"
                              onClick={() => updateQty(id, qty + 1)}
                              className="flex h-8 w-8 items-center justify-center"
                              aria-label="Increase quantity"
                            >
                              <Plus size={13} />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeItem(id)}
                            className="flex h-8 w-8 items-center justify-center rounded-xl text-black/35 hover:bg-[#E1352B]/10 hover:text-[#E1352B]"
                            aria-label={`Remove ${productTitle(item)}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <footer className="border-t border-black/8 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-bold text-black/50">Subtotal</span>
              <span className="font-[family-name:var(--font-mono)] text-xl font-black">
                Rs. {subtotal.toLocaleString()}
              </span>
            </div>

            <button
              type="button"
              onClick={sendWhatsApp}
              className="mb-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0F6A5F] py-3.5 text-xs font-black text-white"
            >
              <MessageCircle size={16} />
              Order on WhatsApp
            </button>

            <Link
              href="/checkout"
              onClick={closeDrawer}
              className="flex w-full items-center justify-center rounded-2xl bg-[#14140F] py-3.5 text-xs font-black text-white"
            >
              Checkout on Website
            </Link>

            <button
              type="button"
              onClick={clearCart}
              className="mt-3 w-full text-[10px] font-black uppercase tracking-wider text-black/35"
            >
              Clear cart
            </button>
          </footer>
        )}
      </aside>
    </div>
  );
}
