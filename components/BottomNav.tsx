'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, ShoppingBag, Users, Sparkles, Package } from 'lucide-react';

const NAV_ITEMS = [
  { key: 'home', label: 'Home', href: '/', icon: Home },
  { key: 'shop', label: 'Shop', href: '/shop', icon: ShoppingBag },
  { key: 'reseller', label: 'Reseller Club', href: '/reseller/dashboard', icon: Users },
  { key: 'skills', label: 'Prime Skills', href: '/skills', icon: Sparkles },
  { key: 'orders', label: 'Orders', href: '/orders', icon: Package },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 px-2 pb-[max(6px,env(safe-area-inset-bottom))] sm:px-4">
      <div className="mx-auto grid max-w-xl grid-cols-5 overflow-hidden rounded-[18px] border border-black/5 bg-[#FFFCF7]/95 px-1 shadow-[0_-6px_25px_rgba(20,20,15,0.13)] backdrop-blur-xl sm:mb-2 sm:rounded-[22px] sm:px-2">
        {NAV_ITEMS.map(({ key, label, href, icon: Icon }) => {
          const isActive = pathname === href || (key === 'reseller' && pathname.startsWith('/reseller')) || (key === 'skills' && pathname.startsWith('/skills'));
          return (
            <Link key={key} href={href} className="group relative flex min-w-0 flex-col items-center gap-1 px-0.5 py-2">
              <span className={`relative flex h-8 w-8 items-center justify-center rounded-[11px] transition-all ${isActive ? '-translate-y-0.5 bg-[#0F6A5F] text-white shadow-[0_7px_16px_rgba(15,106,95,0.28)]' : 'text-[#181914] group-hover:bg-black/5'}`}>
                <Icon className="h-[17px] w-[17px]" aria-hidden="true" />
              </span>
              <span className={`w-full truncate text-center text-[8px] font-black leading-tight sm:text-[9px] ${isActive ? 'text-[#0F6A5F]' : 'text-black/60'}`}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
