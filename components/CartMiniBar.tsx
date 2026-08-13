'use client';

import Link from 'next/link';
import { ShoppingBag, Trash2, Plus, Truck, Minus, X, Maximize2, Home } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useCartStore } from '@/lib/cartStore';
import { useSettings } from '@/lib/useSettings';
import WhatsAppOrderModal from '@/components/WhatsAppOrderModal';

const FALLBACK_THRESHOLD = 5;

function productTitle(item: any) { return item.name || item.title || 'Product'; }
function productImage(item: any) { return item.imageUrl || item.image || item.images?.[0] || ''; }

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
  const clearCart = useCartStore((state) => state.clearCart);
  const [whatsAppOpen, setWhatsAppOpen] = useState(false);

  const threshold = Math.max(1, Number(settings.freeDelivery?.itemThreshold || FALLBACK_THRESHOLD));
  const totalItems = useMemo(() => items.reduce((sum, item) => sum + Number(item.qty || 1), 0), [items]);
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 1), 0), [items]);
  const remaining = Math.max(0, threshold - totalItems);
  const progress = Math.min(100, Math.round((totalItems / threshold) * 100));
  const message = remaining > 0
    ? String(settings.freeDelivery?.message || 'Add {remaining} more item{plural} to unlock FREE DELIVERY')
        .replace('{remaining}', String(remaining))
        .replace('{plural}', remaining === 1 ? '' : 's')
    : String(settings.freeDelivery?.unlockedMessage || 'FREE DELIVERY UNLOCKED 🎉');

  if (!items.length) return null;

  if (!isDrawerOpen && !isMiniCollapsed) return null;

  if (isMiniCollapsed) {
    return (
      <button type="button" onClick={openDrawer} className="fixed bottom-[68px] left-1/2 z-[100] flex w-[calc(100%-20px)] max-w-sm -translate-x-1/2 items-center gap-3 rounded-full border border-white/10 bg-[#151510]/[.98] px-4 py-3 text-left text-white shadow-[0_18px_70px_rgba(0,0,0,.28)] backdrop-blur-xl sm:bottom-4" aria-label="Open cart">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFB020] text-[#151510]"><ShoppingBag size={16} /></span>
        <span className="min-w-0 flex-1"><span className="block text-[10px] font-black uppercase tracking-[.14em]">Cart · {totalItems} item{totalItems === 1 ? '' : 's'}</span><span className="mt-0.5 block font-[family-name:var(--font-mono)] text-sm font-black">Rs. {subtotal.toLocaleString()}</span></span>
        <Maximize2 size={15} className="shrink-0 text-white/55" />
      </button>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-[58px] z-[100] px-2.5 sm:bottom-3 sm:px-4">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-[24px] border border-white/10 bg-[#151510]/[.99] text-white shadow-[0_18px_70px_rgba(0,0,0,.35)] backdrop-blur-xl">
        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5 sm:px-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10"><ShoppingBag size={15} /></div>
          <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#FFB020]">Cart · {totalItems} item{totalItems === 1 ? '' : 's'}</p><p className="font-[family-name:var(--font-mono)] text-xs font-black">Rs. {subtotal.toLocaleString()}</p></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#FFB020] transition-all duration-500" style={{ width: `${progress}%` }} /></div></div>
          <button type="button" onClick={minimizeCart} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/8 text-white/65 hover:bg-white/15 hover:text-white" aria-label="Minimize cart"><Minus size={14} /></button>
          <button type="button" onClick={closeDrawer} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/8 text-white/65 hover:bg-white/15 hover:text-white" aria-label="Close floating cart"><X size={14} /></button>
        </div>

        <div className="max-h-[42vh] overflow-y-auto px-3 py-2.5 sm:px-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {items.map((item) => {
              const qty = Number(item.qty || 1);
              const image = productImage(item);
              return (
                <div key={String(item.id)} className="flex min-w-0 items-center gap-2 rounded-2xl bg-white/[.07] p-2">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white/10">{image && <img src={image} alt={productTitle(item)} className="h-full w-full object-cover" />}</div>
                  <div className="min-w-0 flex-1"><p className="truncate text-[9px] font-bold text-white/80">{productTitle(item)}</p><p className="mt-0.5 text-[10px] font-black">Rs. {Number(item.price).toLocaleString()}</p><div className="mt-1 flex items-center rounded-lg bg-white/10 w-fit"><button type="button" onClick={() => qty <= 1 ? removeItem(item.id) : updateQty(item.id, qty - 1)} className="flex h-6 w-6 items-center justify-center" aria-label="Decrease quantity">−</button><span className="w-6 text-center text-[9px] font-black">{qty}</span><button type="button" onClick={() => updateQty(item.id, qty + 1)} className="flex h-6 w-6 items-center justify-center" aria-label="Increase quantity">+</button></div></div>
                  <button type="button" onClick={() => removeItem(item.id)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/45 hover:bg-[#E1352B]/20 hover:text-[#ff7168]" aria-label={`Delete ${productTitle(item)}`}><Trash2 size={12} /></button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t border-white/10 px-3 py-2.5 sm:px-4">
          <div className="mb-2 flex items-center justify-between"><span className="text-[9px] font-bold text-white/55">{message}</span><span className="font-[family-name:var(--font-mono)] text-sm font-black">Rs. {subtotal.toLocaleString()}</span></div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Link href="/shop" onClick={closeDrawer} className="inline-flex items-center justify-center gap-1 rounded-full border border-white/15 bg-white/8 px-3 py-2 text-[9px] font-black"><Plus size={11} />Add more products</Link>
            <Link href="/" onClick={closeDrawer} className="inline-flex items-center justify-center gap-1 rounded-full border border-white/15 bg-white/8 px-3 py-2 text-[9px] font-black"><Home size={11} />Home</Link>
            <Link href="/cart" onClick={closeDrawer} className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/8 px-3 py-2 text-[9px] font-black">View cart</Link>
            <button type="button" onClick={() => setWhatsAppOpen(true)} className="inline-flex items-center justify-center rounded-full bg-[#0F6A5F] px-3 py-2 text-[9px] font-black">WhatsApp Order</button>
            <Link href="/checkout" onClick={closeDrawer} className="col-span-2 inline-flex items-center justify-center rounded-full bg-white px-4 py-2.5 text-[9px] font-black text-[#151510] sm:col-span-1">Checkout</Link>
          </div>
          <button type="button" onClick={clearCart} className="mt-2 w-full text-[9px] font-black uppercase tracking-wider text-white/30">Clear cart</button>
        </div>
      </div>
      {whatsAppOpen && <WhatsAppOrderModal items={items} onClose={() => setWhatsAppOpen(false)} />}
    </div>
  );
}
