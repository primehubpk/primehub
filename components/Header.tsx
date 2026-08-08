// components/Header.tsx
// Combines SECTION 0 (black announcement marquee) and SECTION 1
// (logo, cart badge, search, free delivery progress bar).
//
// UPDATED: announcement text and the free-shipping threshold now come
// live from Firestore (`settings/main`) via the shared useSettings hook,
// instead of being hardcoded — so editing them in the admin panel
// updates the storefront immediately.

'use client';

import { useState } from 'react';
import { Search, ShoppingCart, Truck } from 'lucide-react';
import { useCartStore } from '@/lib/cartStore';
import { useSettings } from '@/lib/useSettings';

// ==========================================
// SECTION 0: BLACK ANNOUNCEMENT TOP BAR (scrolling marquee)
// ==========================================
function AnnouncementBar({ text }: { text: string }) {
  return (
    <div className="bg-[#0A0A0A] text-white overflow-hidden whitespace-nowrap py-2">
      <div className="inline-flex animate-marquee">
        {[0, 1].map((dup) => (
          <span key={dup} className="mx-6 text-xs tracking-wide flex items-center gap-2 shrink-0">
            <Truck className="w-3.5 h-3.5 text-[#FFB020]" aria-hidden="true" />
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}

// ==========================================
// SECTION 1: HEADER, SEARCH, FREE DELIVERY PROGRESS BAR
// ==========================================
export default function Header() {
  const [searchQuery, setSearchQuery] = useState('');
  const { settings } = useSettings();

  const cartCount = useCartStore((s) => s.getCartCount());
  const cartItemCount = useCartStore((s) => s.items.reduce((sum, i) => sum + i.qty, 0));
  const openDrawer = useCartStore((s) => s.openDrawer);

  const itemsToGo = Math.max(0, settings.freeShippingCount - cartItemCount);
  const deliveryProgress = Math.min(100, Math.round((cartItemCount / settings.freeShippingCount) * 100));

  return (
    <>
      <AnnouncementBar text={settings.announcementText} />

      <header className="sticky top-0 z-40 bg-[#F4F4F1]/95 backdrop-blur border-b border-black/10">
        <div className="max-w-md mx-auto px-4 pt-3 pb-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
              ph<span className="text-[#E1352B]">deals</span>
            </h1>
            <button
              type="button"
              onClick={openDrawer}
              aria-label={`Cart, ${cartCount} items`}
              className="relative w-10 h-10 rounded-full bg-[#14140F] text-white flex items-center justify-center active:scale-95 transition"
            >
              <ShoppingCart className="w-5 h-5" aria-hidden="true" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#E1352B] text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#F4F4F1]">
                  {cartCount}
                </span>
              )}
            </button>
          </div>

          {/* Live search */}
          <div className="flex items-center gap-2 bg-white border border-black/10 rounded-full px-4 py-2.5">
            <Search className="w-4 h-4 text-black/40 shrink-0" aria-hidden="true" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search bangles, kitchen, tech..."
              className="bg-transparent text-sm w-full outline-none placeholder:text-black/40"
            />
          </div>

          {/* Free delivery progress bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-[11px] font-medium mb-1">
              <span className="text-[#0F6A5F]">
                {itemsToGo === 0
                  ? 'Free delivery unlocked!'
                  : `Add ${itemsToGo} more items for FREE delivery`}
              </span>
              <span className="text-black/40">
                {cartItemCount}/{settings.freeShippingCount}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#0F6A5F] transition-all duration-500"
                style={{ width: `${deliveryProgress}%` }}
              />
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
