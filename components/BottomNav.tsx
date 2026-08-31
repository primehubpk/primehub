// components/BottomNav.tsx
// SECTION 9: Fixed mobile bottom navigation — Home, Shop, Rewards,
// Cart, Orders. Mounted once in app/layout.tsx so it persists across
// every route. Highlights the active tab based on the current path.

'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, ShoppingBag, Users, ShoppingCart, Package } from 'lucide-react';
import { useCartStore } from '@/lib/cartStore';

const NAV_ITEMS = [
  { key: 'home', label: 'Home', href: '/', icon: Home },
  { key: 'shop', label: 'Shop', href: '/shop', icon: ShoppingBag },
  { key: 'reseller', label: 'Reseller Club', href: '/reseller/dashboard', icon: Users },
  { key: 'cart', label: 'Cart', href: '/cart', icon: ShoppingCart },
  { key: 'orders', label: 'Orders', href: '/orders', icon: Package },
];

export default function BottomNav() {
  const pathname = usePathname();
  const cartCount = useCartStore((s) => s.getCartCount());

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-black/10">
      <div className="max-w-md mx-auto grid grid-cols-5">
        {NAV_ITEMS.map(({ key, label, href, icon: Icon }) => {
          const isActive = pathname === href || (key === 'reseller' && pathname.startsWith('/reseller'));
          return (
            <Link
              key={key}
              href={href}
              className="relative flex flex-col items-center gap-0.5 py-2.5"
            >
              <Icon
                className={`w-5 h-5 ${isActive ? 'text-[#E1352B]' : 'text-black/40'}`}
                aria-hidden="true"
              />
              <span className={`text-[9px] font-medium ${isActive ? 'text-[#E1352B]' : 'text-black/40'}`}>
                {label}
              </span>
              {key === 'cart' && cartCount > 0 && (
                <span className="absolute top-1 right-[calc(50%-18px)] bg-[#E1352B] text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
