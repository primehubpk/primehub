'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { GraduationCap, Home, Package, ShoppingBag, Users } from 'lucide-react';

const NAV_ITEMS = [
  { key: 'home', label: 'Home', href: '/', icon: Home },
  { key: 'shop', label: 'Shop', href: '/shop', icon: ShoppingBag },
  { key: 'reseller', label: 'Reseller Club', href: '/reseller/dashboard', icon: Users },
  { key: 'skills', label: 'Prime Skills', href: '/skills', icon: GraduationCap },
  { key: 'orders', label: 'Orders', href: '/orders', icon: Package },
] as const;

function isItemActive(pathname: string, key: (typeof NAV_ITEMS)[number]['key'], href: string) {
  if (key === 'home') return pathname === '/';
  if (key === 'reseller') return pathname === href || pathname.startsWith('/reseller/');
  if (key === 'skills') return pathname === href || pathname.startsWith('/skills/');
  return pathname === href;
}

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const warmRoute = useCallback((href: string) => {
    if (href !== pathname) router.prefetch(href);
  }, [pathname, router]);

  return (
    <nav
      aria-label="Bottom navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#C9BFB0] bg-[#FFFDF8]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
    >
      <div className="mx-auto grid w-full max-w-[650px] grid-cols-5">
        {NAV_ITEMS.map(({ key, label, href, icon: Icon }) => {
          const isActive = isItemActive(pathname, key, href);

          return (
            <Link
              key={key}
              href={href}
              prefetch={true}
              aria-current={isActive ? 'page' : undefined}
              data-nav-key={key}
              onPointerEnter={() => warmRoute(href)}
              onFocus={() => warmRoute(href)}
              onPointerDown={() => warmRoute(href)}
              className={`group relative flex min-w-0 flex-col items-center justify-center gap-1 px-0.5 py-2.5 transition-transform duration-100 active:scale-[0.97] ${isActive ? 'text-[#005448]' : 'text-[#131915]'}`}
            >
              <span className="flex h-8 w-8 items-center justify-center">
                <Icon className="h-[27px] w-[27px] stroke-[1.35]" aria-hidden="true" />
              </span>
              <span className={`w-full truncate text-center text-[10px] leading-tight ${isActive ? 'font-bold text-[#005448]' : 'font-medium text-[#141510]'}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
