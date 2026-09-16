'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { GraduationCap, Home, Package, ShoppingBag, Users } from 'lucide-react';
import { auth } from '@/lib/firebase';

const RESELLER_DASHBOARD = '/reseller/dashboard';
const RESELLER_JOIN = '/reseller/join';

const NAV_ITEMS = [
  { key: 'home', label: 'Home', href: '/', icon: Home },
  { key: 'shop', label: 'Shop', href: '/shop', icon: ShoppingBag },
  { key: 'reseller', label: 'Reseller Club', href: RESELLER_DASHBOARD, icon: Users },
  { key: 'skills', label: 'Prime Skills', href: '/skills', icon: GraduationCap },
  { key: 'orders', label: 'Orders', href: '/orders', icon: Package },
] as const;

type NavItem = (typeof NAV_ITEMS)[number];

function isShopRoute(pathname: string) {
  return (
    pathname === '/shop' ||
    pathname.startsWith('/shop/') ||
    pathname.startsWith('/product/') ||
    pathname === '/new-arrivals' ||
    pathname.startsWith('/new-arrivals/') ||
    pathname === '/weekly-deals' ||
    pathname.startsWith('/weekly-deals/') ||
    pathname.startsWith('/deals/')
  );
}

function isSaleMelaRoute(pathname: string) {
  return pathname === '/primehubmall/salemela' || pathname.startsWith('/primehubmall/salemela/');
}

function isItemActive(pathname: string, item: NavItem) {
  if (item.key === 'home') return pathname === '/' || isSaleMelaRoute(pathname);
  if (item.key === 'shop') return isShopRoute(pathname);
  if (item.key === 'reseller') {
    return pathname === '/reseller' || pathname === item.href || pathname.startsWith('/reseller/');
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function isPlainLeftClick(event: React.MouseEvent<HTMLAnchorElement>) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [resellerUser, setResellerUser] = useState<User | null>(() => auth.currentUser);
  const [authResolved, setAuthResolved] = useState(() => Boolean(auth.currentUser));

  useEffect(() => {
    router.prefetch(RESELLER_JOIN);
    router.prefetch(RESELLER_DASHBOARD);
    return onAuthStateChanged(auth, user => {
      setResellerUser(user);
      setAuthResolved(true);
      router.prefetch(user ? RESELLER_DASHBOARD : RESELLER_JOIN);
    });
  }, [router]);

  useEffect(() => {
    const hrefs = [
      ...NAV_ITEMS.map(({ href }) => href),
      RESELLER_JOIN,
      RESELLER_DASHBOARD,
    ].filter((href, index, list) => href !== pathname && list.indexOf(href) === index);
    const warmRoutes = () => hrefs.forEach((href) => router.prefetch(href));
    const browser = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (browser.requestIdleCallback) {
      const idleId = browser.requestIdleCallback(warmRoutes, { timeout: 1200 });
      return () => browser.cancelIdleCallback?.(idleId);
    }

    const timer = window.setTimeout(warmRoutes, 250);
    return () => window.clearTimeout(timer);
  }, [pathname, router]);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  useEffect(() => {
    if (!pendingHref) return;
    const timer = window.setTimeout(() => setPendingHref(null), 5000);
    return () => window.clearTimeout(timer);
  }, [pendingHref]);

  return (
    <nav
      aria-label="Bottom navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#C9BFB0] bg-[#FFFDF8]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
    >
      <div className="mx-auto grid min-h-[72px] w-full max-w-[650px] grid-cols-5">
        {NAV_ITEMS.map((item) => {
          const { key, label, icon: Icon } = item;
          const href = key === 'reseller'
            ? authResolved && resellerUser
              ? RESELLER_DASHBOARD
              : RESELLER_JOIN
            : item.href;
          const routeIsActive = isItemActive(pathname, item);
          const isPending = pendingHref === href && pathname !== href;
          const visuallyActive = pendingHref ? pendingHref === href : routeIsActive;

          return (
            <Link
              key={key}
              href={href}
              prefetch
              scroll
              aria-current={routeIsActive ? 'page' : undefined}
              aria-busy={isPending || undefined}
              data-nav-key={key}
              data-active={routeIsActive ? 'true' : 'false'}
              data-pending={isPending ? 'true' : 'false'}
              onPointerEnter={() => router.prefetch(href)}
              onPointerDown={() => router.prefetch(href)}
              onFocus={() => router.prefetch(href)}
              onClick={(event) => {
                if (!isPlainLeftClick(event)) return;

                if (key === 'home') {
                  event.preventDefault();
                  if (pathname === '/') {
                    setPendingHref(null);
                    if (window.location.hash) window.history.replaceState(null, '', '/');
                    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
                  } else {
                    setPendingHref('/');
                    router.push('/', { scroll: true });
                  }
                  return;
                }

                if (key === 'reseller') {
                  event.preventDefault();
                  setPendingHref(href);
                  void auth.authStateReady().then(() => {
                    const target = auth.currentUser ? RESELLER_DASHBOARD : RESELLER_JOIN;
                    setResellerUser(auth.currentUser);
                    setAuthResolved(true);
                    router.prefetch(target);
                    setPendingHref(target);
                    if (pathname === target) {
                      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
                    } else {
                      router.push(target, { scroll: true });
                    }
                  });
                  return;
                }

                if (pathname !== href) setPendingHref(href);
              }}
              className={`group relative flex min-w-0 touch-manipulation select-none flex-col items-center justify-center gap-1 px-0.5 py-2.5 transition-[color,background-color,transform] duration-100 active:scale-[0.98] active:bg-black/[0.035] ${
                visuallyActive ? 'text-[#005448]' : 'text-[#131915]'
              }`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                <Icon className="h-[27px] w-[27px] shrink-0 stroke-[1.35]" aria-hidden="true" />
              </span>
              <span
                className={`w-full truncate text-center text-[10px] leading-tight ${
                  visuallyActive ? 'font-bold text-[#005448]' : 'font-medium text-[#141510]'
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
