'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import { useCartStore } from '@/lib/cartStore';

/**
 * A one-tap way back to the full cart while browsing or scrolling anywhere.
 * Independent from the existing cart mini panel and its minimize/drawer state.
 */
export default function FloatingCartShortcut() {
  const pathname = usePathname();
  const items = useCartStore((state) => state.items);
  const [hydrated, setHydrated] = useState(false);

  // Persisted cart is read from localStorage on the client. Avoid a stale
  // server-rendered badge and keep the empty state completely invisible.
  useEffect(() => setHydrated(true), []);

  const count = items.reduce((total, item) => total + Math.max(0, Number(item.qty) || 0), 0);
  const isCheckoutOrCart = pathname === '/cart' || pathname.startsWith('/cart/') ||
    pathname === '/checkout' || pathname.startsWith('/checkout/');
  const isAdministration = pathname === '/admin' || pathname.startsWith('/admin/');

  if (!hydrated || count === 0 || isCheckoutOrCart || isAdministration) return null;

  return (
    <Link
      href="/cart"
      prefetch={false}
      aria-label={`View shopping cart, ${count} item${count === 1 ? '' : 's'}`}
      title="View cart"
      className="fixed left-2 top-[43%] z-[60] flex h-12 w-12 -translate-y-1/2 touch-manipulation items-center justify-center rounded-full border-2 border-white bg-[#14140F] text-white shadow-[0_8px_26px_rgba(20,20,15,0.28)] transition-transform active:scale-95 sm:left-4 sm:h-14 sm:w-14"
    >
      <ShoppingCart size={21} aria-hidden="true" />
      <span aria-hidden="true" className="absolute -right-1.5 -top-1.5 flex min-h-6 min-w-6 items-center justify-center rounded-full bg-[#E1352B] px-1 text-[10px] font-black leading-none text-white ring-2 ring-white">
        {count > 99 ? '99+' : count}
      </span>
    </Link>
  );
}
