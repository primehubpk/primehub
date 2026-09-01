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
    <nav className="fixed inset-x-0 bottom-0 z-40 px-2 pb-[max(6px,env(safe-area-inset-bottom))] sm:px-4">
      <div className="mx-auto grid max-w-xl grid-cols-5 overflow-hidden rounded-[22px] border border-white/80 bg-white/95 px-1 shadow-[0_-6px_30px_rgba(20,20,15,0.12)] ring-1 ring-black/5 backdrop-blur-xl sm:mb-2 sm:rounded-[26px] sm:px-2">
        {NAV_ITEMS.map(({ key, label, href, icon: Icon }) => {
          const isActive = pathname === href || (key === 'reseller' && pathname.startsWith('/reseller'));
          return (
            <Link key={key} href={href} className="group relative flex flex-col items-center gap-1 px-0.5 py-2">
              <span className={`relative flex h-8 w-8 items-center justify-center rounded-full bg-[#14140F] text-white transition-all ${isActive ? '-translate-y-0.5 shadow-[0_7px_16px_rgba(20,20,15,0.3)] ring-2 ring-[#E1352B]/25' : 'opacity-80 shadow-md group-hover:opacity-100'}`}>
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
              <span className={`max-w-full truncate text-[8px] font-black sm:text-[9px] ${isActive ? 'text-[#E1352B]' : 'text-black/55'}`}>{label}</span>
              {key === 'cart' && cartCount > 0 && <span className="absolute right-[calc(50%-20px)] top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#E1352B] px-1 text-[8px] font-bold text-white ring-2 ring-white">{cartCount}</span>}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
