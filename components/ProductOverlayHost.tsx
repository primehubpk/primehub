'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import ProductDetailPageClient from '@/components/product-detail/ProductDetailPageClient';
import { readCachedProduct } from '@/lib/productNavigationCache';
import {
  claimStorefrontClick,
  closeProductOverlayNow,
  getProductOverlayBackgroundPath,
  getProductOverlayServerSnapshot,
  getProductOverlaySnapshot,
  installProductOverlayHistoryListener,
  isProductOverlayOpen,
  navigateFromProductOverlay,
  openProductOverlay,
  productTargetFromHref,
  requestStorefrontHome,
  resetStorefrontClickClaim,
  subscribeProductOverlay,
  type ProductOverlayProduct,
} from '@/lib/productOverlay';

function isPlainLeftClick(event: MouseEvent) {
  if (event.defaultPrevented || event.button !== 0) return false;
  return !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

function productAnchor(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;
  const anchor = target.closest('a[href]') as HTMLAnchorElement | null;
  if (!anchor || anchor.hasAttribute('download')) return null;
  if (anchor.target && anchor.target !== '_self') return null;
  return anchor;
}

function openFromProductHref(href: string) {
  const target = productTargetFromHref(href, window.location.origin);
  if (!target) return;
  const cached = readCachedProduct<ProductOverlayProduct>(target.id);
  openProductOverlay({
    id: target.id,
    href: target.href,
    bigDeal: target.bigDeal,
    product: cached,
  });
}

type ProductOpenerWindow = Window & {
  __phOpenProduct?: (href: string) => void;
  __phPendingProduct?: string;
};

function assignProductOpener() {
  if (typeof window === 'undefined') return;
  (window as ProductOpenerWindow).__phOpenProduct = openFromProductHref;
}

function flushPendingProduct() {
  if (typeof window === 'undefined') return;
  const browser = window as ProductOpenerWindow;
  if (!browser.__phPendingProduct) return;
  const pending = browser.__phPendingProduct;
  delete browser.__phPendingProduct;
  openFromProductHref(pending);
}

assignProductOpener();
flushPendingProduct();

function handleStorefrontClick(event: MouseEvent) {
  resetStorefrontClickClaim();
  if (!isPlainLeftClick(event)) return;
  const anchor = productAnchor(event.target);
  if (!anchor) return;

  const url = new URL(anchor.href, window.location.origin);
  if (url.origin !== window.location.origin) return;

  const target = productTargetFromHref(url.pathname + url.search, window.location.origin);
  if (target) {
    if (anchor.closest('.home-big-deal')) {
      target.bigDeal = true;
      const dealUrl = new URL(target.href, window.location.origin);
      dealUrl.searchParams.set('deal', 'big');
      target.href = `${dealUrl.pathname}${dealUrl.search}`;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    claimStorefrontClick();
    const cached = readCachedProduct<ProductOverlayProduct>(target.id);
    openProductOverlay({
      id: target.id,
      href: target.href,
      bigDeal: target.bigDeal,
      product: cached,
    });
    return;
  }

  if (!isProductOverlayOpen()) return;
  if (url.pathname === '/' && !url.search) {
    event.preventDefault();
    event.stopImmediatePropagation();
    claimStorefrontClick();
    const action = requestStorefrontHome();
    if (action === 'router-home') {
      window.dispatchEvent(new CustomEvent('ph-overlay-navigate', { detail: '/' }));
    }
    return;
  }
  const backgroundPath = getProductOverlayBackgroundPath();
  let backgroundPathname = '';
  try {
    backgroundPathname = backgroundPath ? new URL(backgroundPath, window.location.origin).pathname : '';
  } catch {
    backgroundPathname = '';
  }
  event.preventDefault();
  event.stopImmediatePropagation();
  claimStorefrontClick();
  if (backgroundPathname === url.pathname) {
    closeProductOverlayNow();
    return;
  }
  navigateFromProductOverlay(`${url.pathname}${url.search}${url.hash}`);
}

export default function ProductOverlayHost() {
  assignProductOpener();
  const router = useRouter();
  const snapshot = useSyncExternalStore(
    subscribeProductOverlay,
    getProductOverlaySnapshot,
    getProductOverlayServerSnapshot,
  );

  useEffect(() => {
    assignProductOpener();
    flushPendingProduct();
    installProductOverlayHistoryListener();
    const onNavigate = (event: Event) => {
      const href = (event as CustomEvent<string>).detail;
      if (typeof href !== 'string' || !href.startsWith('/')) return;
      const target = new URL(href, window.location.origin);
      const wanted = `${target.pathname}${target.search}`;
      router.replace(`${wanted}${target.hash}`, { scroll: target.pathname !== '/' });

    };
    document.addEventListener('click', handleStorefrontClick, true);
    window.addEventListener('ph-overlay-navigate', onNavigate);
    return () => {
      document.removeEventListener('click', handleStorefrontClick, true);
      window.removeEventListener('ph-overlay-navigate', onNavigate);
    };
  }, [router]);

  const frame = snapshot.frame;
  if (!frame) return null;

  return (
    <div data-ph-product-overlay="" className="fixed inset-0 z-[35] overflow-y-auto overscroll-contain bg-[#F4F4F1]">
      <ProductDetailPageClient
        key={`${frame.id}:${frame.bigDeal ? 'big' : 'regular'}`}
        initialProduct={frame.product as never}
        productId={frame.id}
        bigDeal={frame.bigDeal}
      />
    </div>
  );
}
