'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect } from 'react';
import type { ComponentProps } from 'react';
import {
  cacheProductForNavigation,
  loadProductsForNavigation,
  readCachedProduct,
} from '@/lib/productNavigationCache';

type NavigableProduct = { id?: unknown; [key: string]: unknown };
type LinkProps = ComponentProps<typeof Link>;
type FastProductLinkProps = Omit<LinkProps, 'href'> & {
  product?: NavigableProduct | null;
  productId?: string;
  href?: string;
  dealContext?: 'big';
};

const warmedRoutes = new Set<string>();

function addBigDealContext(href: string) {
  if (!href.startsWith('/product/')) return href;
  if (/(?:\?|&)deal=big(?:&|$)/.test(href)) return href;
  const hashIndex = href.indexOf('#');
  const base = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : '';
  return `${base}${base.includes('?') ? '&' : '?'}deal=big${hash}`;
}

function productRouteId(href: string) {
  if (typeof window === 'undefined' || !href) return '';
  try {
    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin) return '';
    const match = url.pathname.match(/^\/product\/([^/]+)\/?$/);
    return match ? decodeURIComponent(match[1]) : '';
  } catch {
    return '';
  }
}

function productRouteHref(href: string) {
  if (typeof window === 'undefined' || !href) return '';
  try {
    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin || !/^\/product\/[^/]+\/?$/.test(url.pathname)) return '';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '';
  }
}

export default function FastProductLink({
  product,
  productId,
  href,
  dealContext,
  prefetch,
  onPointerEnter,
  onPointerDown,
  onTouchStart,
  onFocus,
  onClick,
  ...props
}: FastProductLinkProps) {
  const router = useRouter();
  const id = String(productId || product?.id || '').trim();
  const baseHref = href || (id ? `/product/${encodeURIComponent(id)}` : '/shop');
  const resolvedHref = dealContext === 'big' ? addBigDealContext(baseHref) : baseHref;

  const warm = useCallback(() => {
    if (product) cacheProductForNavigation(product);
    if (id && !product && !readCachedProduct(id)) void loadProductsForNavigation([id]);
    router.prefetch(resolvedHref);
  }, [id, product, resolvedHref, router]);

  return (
    <Link
      {...props}
      href={resolvedHref}
      prefetch={prefetch ?? true}
      onPointerEnter={(event) => {
        onPointerEnter?.(event);
        if (!event.defaultPrevented) warm();
      }}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        if (!event.defaultPrevented) warm();
      }}
      onTouchStart={(event) => {
        onTouchStart?.(event);
        if (!event.defaultPrevented) warm();
      }}
      onFocus={(event) => {
        onFocus?.(event);
        if (!event.defaultPrevented) warm();
      }}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) warm();
      }}
    />
  );
}

export function ProductNavigationIntentBridge() {
  const router = useRouter();

  useEffect(() => {
    const warmAnchor = (event: Event) => {
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest('a[href]');
      const rawHref = anchor?.getAttribute('href') || '';
      const routeHref = productRouteHref(rawHref);
      if (!routeHref) return;

      if (!warmedRoutes.has(routeHref)) {
        warmedRoutes.add(routeHref);
        router.prefetch(routeHref);
      }

      const id = productRouteId(routeHref);
      if (!id) return;
      queueMicrotask(() => {
        if (!readCachedProduct(id)) void loadProductsForNavigation([id]);
      });
    };

    document.addEventListener('pointerover', warmAnchor, true);
    document.addEventListener('pointerdown', warmAnchor, true);
    document.addEventListener('touchstart', warmAnchor, { capture: true, passive: true });
    document.addEventListener('focusin', warmAnchor, true);
    return () => {
      document.removeEventListener('pointerover', warmAnchor, true);
      document.removeEventListener('pointerdown', warmAnchor, true);
      document.removeEventListener('touchstart', warmAnchor, true);
      document.removeEventListener('focusin', warmAnchor, true);
    };
  }, [router]);

  return null;
}
