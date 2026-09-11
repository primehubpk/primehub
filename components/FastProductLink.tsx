'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
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

function addBigDealContext(href: string) {
  if (!href.startsWith('/product/')) return href;
  if (/(?:\?|&)deal=big(?:&|$)/.test(href)) return href;
  const hashIndex = href.indexOf('#');
  const base = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : '';
  return `${base}${base.includes('?') ? '&' : '?'}deal=big${hash}`;
}

export default function FastProductLink({
  product,
  productId,
  href,
  dealContext,
  prefetch,
  onPointerEnter,
  onPointerDown,
  onFocus,
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
      prefetch={prefetch ?? false}
      onPointerEnter={(event) => {
        onPointerEnter?.(event);
        if (!event.defaultPrevented) warm();
      }}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        if (!event.defaultPrevented) warm();
      }}
      onFocus={(event) => {
        onFocus?.(event);
        if (!event.defaultPrevented) warm();
      }}
    />
  );
}
