'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { GraduationCap, Home, Package, ShoppingBag, Users } from 'lucide-react';

const NAV_ITEMS = [
  { key: 'home', label: 'Home', href: '/', icon: Home },
  { key: 'shop', label: 'Shop', href: '/shop', icon: ShoppingBag },
  { key: 'reseller', label: 'Reseller Club', href: '/reseller/dashboard', icon: Users },
  { key: 'skills', label: 'Prime Skills', href: '/skills', icon: GraduationCap },
  { key: 'orders', label: 'Orders', href: '/orders', icon: Package },
] as const;

type NavItem = (typeof NAV_ITEMS)[number];

function isItemActive(pathname: string, item: NavItem) {
  if (item.key === 'home') return pathname === '/';
  if (item.key === 'reseller') {
    return pathname === '/reseller' || pathname === item.href || pathname.startsWith('/reseller/');
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export default function BottomNav() {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const pendingResetTimer = useRef<number | null>(null);

  const markNavigationIntent = (href: string) => {
    if (href === pathname) return;
    setPendingHref(href);

    if (pendingResetTimer.current != null) window.clearTimeout(pendingResetTimer.current);
    pendingResetTimer.current = window.setTimeout(() => {
      setPendingHref((current) => (current === href ? null : current));
      pendingResetTimer.current = null;
    }, 2500);
  };

  useEffect(() => {
    setPendingHref(null);
    if (pendingResetTimer.current != null) {
      window.clearTimeout(pendingResetTimer.current);
      pendingResetTimer.current = null;
    }
  }, [pathname]);

  useEffect(() => () => {
    if (pendingResetTimer.current != null) window.clearTimeout(pendingResetTimer.current);
  }, []);

  return (
    <nav
      aria-label="Bottom navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#C9BFB0] bg-[#FFFDF8]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
    >
      <div className="mx-auto grid min-h-[72px] w-full max-w-[650px] grid-cols-5">
        {NAV_ITEMS.map((item) => {
          const { key, label, href, icon: Icon } = item;
          const isActive = isItemActive(pathname, item);
          const isPending = !isActive && pendingHref === href;

          return (
            <Link
              key={key}
              href={href}
              prefetch={true}
              aria-current={isActive ? 'page' : undefined}
              data-nav-key={key}
              data-active={isActive ? 'true' : 'false'}
              data-pending={isPending ? 'true' : 'false'}
              onPointerDown={() => markNavigationIntent(href)}
              className={`group relative flex min-w-0 touch-manipulation select-none flex-col items-center justify-center gap-1 px-0.5 py-2.5 ${
                isPending ? 'bg-black/[0.035]' : ''
              } ${isActive ? 'text-[#005448]' : 'text-[#131915]'}`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                <Icon className="h-[27px] w-[27px] shrink-0 stroke-[1.35]" aria-hidden="true" />
              </span>
              <span
                className={`w-full truncate text-center text-[10px] leading-tight ${
                  isActive ? 'font-bold text-[#005448]' : 'font-medium text-[#141510]'
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
