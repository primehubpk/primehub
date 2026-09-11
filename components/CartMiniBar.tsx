'use client';

import Link from 'next/link';
import { ImageOff, Maximize2, Minus, Plus, Home, ShoppingBag, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCartStore } from '@/lib/cartStore';
import { useSettings } from '@/lib/useSettings';
import WhatsAppOrderModal from '@/components/WhatsAppOrderModal';
import CartItemControls from './cart/CartItemControls';

const FALLBACK_THRESHOLD = 5;
const titleOf = (item: any) => item.name || item.title || 'Product';
const imageOf = (item: any) => item?.imageUrl || item?.image || item?.images?.[0] || '';
const money = (value: number) => `Rs. ${Number(value || 0).toLocaleString()}`;
const productIdOf = (item: any) => String(item?.productId || String(item?.id || '').split(':')[0] || '').trim();

export default function CartMiniBar() {
  const { settings } = useSettings();
  const items = useCartStore((state) => state.items);
  const isDrawerOpen = useCartStore((state) => state.isDrawerOpen);
  const isMiniCollapsed = useCartStore((state) => state.isMiniCollapsed);
  const openDrawer = useCartStore((state) => state.openDrawer);
  const closeDrawer = useCartStore((state) => state.closeDrawer);
  const minimizeCart = useCartStore((state) => state.minimizeCart);
  const removeItem = useCartStore((state) => state.removeItem);
  const updateQty = useCartStore((state) => state.updateQty);
  const [whatsAppOpen, setWhatsAppOpen] = useState(false);
  const [resolvedImages, setResolvedImages] = useState<Record<string, string>>({});
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const requestedImageIds = useRef(new Set<string>());

  const threshold = Math.max(1, Number(settings.freeDelivery?.itemThreshold || FALLBACK_THRESHOLD));
  const totalItems = useMemo(() => items.reduce((sum, item) => sum + Number(item.qty || 1), 0), [items]);
  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 1), 0),
    [items],
  );
  const remaining = Math.max(0, threshold - totalItems);
  const progress = Math.min(100, Math.round((totalItems / threshold) * 100));
  const message = remaining > 0
    ? String(settings.freeDelivery?.message || 'Add {remaining} more item{plural} to unlock FREE DELIVERY')
        .replace('{remaining}', String(remaining))
        .replace('{plural}', remaining === 1 ? '' : 's')
    : String(settings.freeDelivery?.unlockedMessage || 'FREE DELIVERY UNLOCKED 🎉');

  useEffect(() => {
    const unresolved = items
      .filter((item) => !imageOf(item) && !resolvedImages[String(item.id)])
      .map((item) => ({ cartKey: String(item.id), productId: productIdOf(item) }))
      .filter((item) => item.productId && !requestedImageIds.current.has(item.productId));
    const ids = Array.from(new Set(unresolved.map((item) => item.productId))).slice(0, 24);
    if (!ids.length) return;

    ids.forEach((id) => requestedImageIds.current.add(id));
    const controller = new AbortController();
    const query = encodeURIComponent(JSON.stringify(ids));

    fetch(`/api/storefront/read?type=products&ids=${query}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`cart image lookup ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (!Array.isArray(data?.products)) return;
        const byId = new Map<string, any>(
          data.products.map((product: any) => [String(product?.id || ''), product]),
        );
        const next: Record<string, string> = {};
        unresolved.forEach(({ cartKey, productId }) => {
          const image = imageOf(byId.get(productId));
          if (image) next[cartKey] = image;
        });
        if (Object.keys(next).length) {
          setResolvedImages((current) => ({ ...current, ...next }));
        }
      })
      .catch(() => {
        ids.forEach((id) => requestedImageIds.current.delete(id));
      });

    return () => {
      controller.abort();
    };
  }, [items, resolvedImages]);

  if (!items.length) return null;
  if (!isDrawerOpen && !isMiniCollapsed) return null;

  if (isMiniCollapsed) {
    return (
      <button
        type="button"
        onClick={openDrawer}
        className="fixed bottom-[calc(72px+env(safe-area-inset-bottom)+8px)] left-1/2 z-[100] flex w-[calc(100%-20px)] max-w-sm -translate-x-1/2 items-center gap-3 rounded-full border border-white/10 bg-[#151510]/[.98] px-4 py-3 text-left text-white shadow-[0_18px_70px_rgba(0,0,0,.28)] backdrop-blur-xl"
        aria-label="Open cart"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFB020] text-[#151510]">
          <ShoppingBag size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-black uppercase tracking-[.14em]">
            Cart · {totalItems} item{totalItems === 1 ? '' : 's'}
          </span>
          <span className="mt-0.5 block font-[family-name:var(--font-mono)] text-sm font-black">
            {money(subtotal)}
          </span>
        </span>
        <Maximize2 size={15} className="shrink-0 text-white/55" />
      </button>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom)+8px)] z-[100] px-2.5 sm:px-4">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-[24px] border border-white/10 bg-[#151510]/[.99] text-white shadow-[0_18px_70px_rgba(0,0,0,.35)] backdrop-blur-xl">
        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5 sm:px-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10">
            <ShoppingBag size={15} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#FFB020]">
                Cart · {totalItems} item{totalItems === 1 ? '' : 's'}
              </p>
              <p className="font-[family-name:var(--font-mono)] text-xs font-black">TOTAL: {money(subtotal)}</p>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[#FFB020] transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <button type="button" onClick={minimizeCart} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/8 text-white/65" aria-label="Minimize cart">
            <Minus size={14} />
          </button>
          <button type="button" onClick={closeDrawer} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/8 text-white/65" aria-label="Close floating cart">
            <X size={14} />
          </button>
        </div>

        <div className="max-h-[42vh] overflow-y-auto px-3 py-2.5 sm:px-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {items.map((item) => {
              const qty = Math.max(1, Number(item.qty || 1));
              const unit = Number(item.price || 0);
              const key = String(item.id);
              const image = imageOf(item) || resolvedImages[key] || '';
              const bad = !image || brokenImages[key];
              const title = titleOf(item);
              return (
                <div key={key} className="flex min-w-0 items-center gap-2.5 rounded-2xl border border-white/8 bg-white/[.07] p-2.5">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-white/10 ring-1 ring-white/10">
                    {!bad ? (
                      <img src={image} alt={title} className="h-full w-full object-cover" onError={() => setBrokenImages((current) => ({ ...current, [key]: true }))} />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-white/30">
                        <ImageOff size={17} />
                        <span className="text-[7px] font-bold">No image</span>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[10px] font-black leading-3.5 text-white">{title}</p>
                    <p className="mt-1 text-[9px] font-bold text-white/55">{money(unit)} × {qty}</p>
                    <div className="mt-1.5">
                      <CartItemControls id={key} qty={qty} title={title} removeItem={removeItem} updateQty={updateQty} dark />
                    </div>
                  </div>
                  <span className="truncate text-[9px] font-black text-[#FFB020]">{money(unit * qty)}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t border-white/10 px-3 py-2.5 sm:px-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-[9px] font-bold text-white/55">{message}</span>
            <span className="shrink-0 font-[family-name:var(--font-mono)] text-sm font-black">Subtotal {money(subtotal)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Link href="/shop" onClick={closeDrawer} className="inline-flex items-center justify-center gap-1 rounded-full border border-white/15 bg-white/8 px-3 py-2 text-[9px] font-black">
              <Plus size={11} />Add more products
            </Link>
            <Link href="/" onClick={closeDrawer} className="inline-flex items-center justify-center gap-1 rounded-full border border-white/15 bg-white/8 px-3 py-2 text-[9px] font-black">
              <Home size={11} />Home
            </Link>
            <Link href="/cart" onClick={closeDrawer} className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/8 px-3 py-2 text-[9px] font-black">
              View cart
            </Link>
            <button type="button" onClick={() => setWhatsAppOpen(true)} className="inline-flex items-center justify-center rounded-full bg-[#0F6A5F] px-3 py-2 text-[9px] font-black">
              WhatsApp Order
            </button>
            <Link href="/checkout" onClick={closeDrawer} className="col-span-2 inline-flex items-center justify-center rounded-full bg-white px-4 py-2.5 text-[9px] font-black text-[#151510] sm:col-span-1">
              Checkout
            </Link>
          </div>
        </div>
      </div>
      {whatsAppOpen && <WhatsAppOrderModal items={items} onClose={() => setWhatsAppOpen(false)} />}
    </div>
  );
}
