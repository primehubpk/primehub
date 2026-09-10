'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { GraduationCap, Home, LoaderCircle, Package, ShoppingBag, Sparkles, Users } from 'lucide-react';

const NAV_ITEMS = [
  { key: 'home', label: 'Home', href: '/', icon: Home },
  { key: 'shop', label: 'Shop', href: '/shop', icon: ShoppingBag },
  { key: 'reseller', label: 'Reseller Club', href: '/reseller/dashboard', icon: Users },
  { key: 'skills', label: 'Prime Skills', href: '/skills', icon: Sparkles },
  { key: 'orders', label: 'Orders', href: '/orders', icon: Package },
] as const;

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const pendingTimer = useRef<number | null>(null);

  const warmRoute = useCallback((href: string) => {
    router.prefetch(href);
  }, [router]);

  useEffect(() => {
    const browser = window as IdleWindow;
    let cancelled = false;
    const timers: number[] = [];

    const warmBottomRoutes = () => {
      NAV_ITEMS.forEach(({ href }, index) => {
        if (href === pathname) return;
        const timer = window.setTimeout(() => {
          if (!cancelled) router.prefetch(href);
        }, index * 90);
        timers.push(timer);
      });
    };

    const idleId = browser.requestIdleCallback?.(warmBottomRoutes, { timeout: 1200 });
    const fallbackTimer = idleId == null ? window.setTimeout(warmBottomRoutes, 220) : null;

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
      if (idleId != null) browser.cancelIdleCallback?.(idleId);
      if (fallbackTimer != null) window.clearTimeout(fallbackTimer);
    };
  }, [pathname, router]);

  useEffect(() => {
    setPendingKey(null);
    if (pendingTimer.current != null) {
      window.clearTimeout(pendingTimer.current);
      pendingTimer.current = null;
    }
  }, [pathname]);

  useEffect(() => () => {
    if (pendingTimer.current != null) window.clearTimeout(pendingTimer.current);
  }, []);

  const markPending = useCallback((key: string, href: string) => {
    warmRoute(href);
    if (pathname === href) return;
    setPendingKey(key);
    if (pendingTimer.current != null) window.clearTimeout(pendingTimer.current);
    pendingTimer.current = window.setTimeout(() => {
      setPendingKey((current) => current === key ? null : current);
      pendingTimer.current = null;
    }, 1800);
  }, [pathname, warmRoute]);

  return (
    <nav aria-label="Bottom navigation" className={`fixed inset-x-0 bottom-0 z-40 px-2 pb-[max(6px,env(safe-area-inset-bottom))] sm:px-4 ${pathname === '/' ? 'home-bottom-nav' : ''}`}>
      <div className="mx-auto grid max-w-xl grid-cols-5 overflow-hidden rounded-[18px] border border-black/5 bg-[#FFFCF7]/95 px-1 shadow-[0_-6px_25px_rgba(20,20,15,0.13)] backdrop-blur-xl sm:mb-2 sm:rounded-[22px] sm:px-2">
        {NAV_ITEMS.map(({ key, label, href, icon: Icon }) => {
          const isActive = pathname === href || (key === 'reseller' && pathname.startsWith('/reseller')) || (key === 'skills' && pathname.startsWith('/skills'));
          const pending = pendingKey === key && pathname !== href;
          const resellerIcon = key === 'reseller';
          return (
            <Link
              key={key}
              href={href}
              prefetch={true}
              aria-current={isActive ? 'page' : undefined}
              aria-busy={pending || undefined}
              data-nav-key={key}
              onPointerEnter={() => warmRoute(href)}
              onFocus={() => warmRoute(href)}
              onTouchStart={() => markPending(key, href)}
              onPointerDown={(event) => {
                if (event.pointerType !== 'touch') markPending(key, href);
              }}
              onClick={() => markPending(key, href)}
              className={`group relative flex min-w-0 flex-col items-center gap-1 rounded-xl px-0.5 py-2 transition duration-150 active:scale-[0.96] ${pending ? 'bg-black/[0.035]' : ''}`}
            >
              <span className={`relative flex h-8 w-8 items-center justify-center rounded-[11px] transition-all ${resellerIcon && !pending && !isActive ? 'reseller-club-nav-icon bg-[#E7F6F3] text-[#0E7C6F]' : ''} ${pending ? 'scale-95 bg-[#0F6A5F] text-white shadow-[0_7px_16px_rgba(15,106,95,0.22)]' : isActive ? '-translate-y-0.5 bg-[#0F6A5F] text-white shadow-[0_7px_16px_rgba(15,106,95,0.28)]' : resellerIcon ? '' : 'text-[#181914] group-hover:bg-black/5'}`}>
                {pending ? (
                  <LoaderCircle className="h-[16px] w-[16px] animate-spin" aria-hidden="true" />
                ) : key === 'skills' && pathname === '/' ? (
                  <GraduationCap className="h-[17px] w-[17px]" aria-hidden="true" />
                ) : (
                  <Icon className="h-[17px] w-[17px]" aria-hidden="true" />
                )}
              </span>
              <span className={`w-full truncate text-center text-[8px] font-black leading-tight sm:text-[9px] ${pending || isActive ? 'text-[#0F6A5F]' : resellerIcon ? 'text-[#0E7C6F]' : 'text-black/60'}`}>
                {pending ? 'Opening…' : label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
