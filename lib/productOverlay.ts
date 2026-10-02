// In-app product opening stays on the current page. A real route change would
// unmount the shop, flash the site footer, and reload every image on the way back.
// The address bar still updates so the Android back button and the top back button
// return to the exact same place.

export type ProductOverlayProduct = { id?: unknown; [key: string]: unknown };

export type ProductOverlayFrame = {
  id: string;
  href: string;
  bigDeal: boolean;
  product: ProductOverlayProduct | null;
};

type BackgroundEntry = {
  state: unknown;
  url: string;
};

type OverlaySnapshot = {
  frame: ProductOverlayFrame | null;
};

const listeners = new Set<() => void>();
let frame: ProductOverlayFrame | null = null;
let background: BackgroundEntry | null = null;
let popListenerInstalled = false;
let pendingNavigation: string | null = null;

const serverSnapshot: OverlaySnapshot = { frame: null };
let clientSnapshot: OverlaySnapshot = { frame: null };

function emit() {
  clientSnapshot = { frame };
  listeners.forEach((listener) => listener());
}

export function subscribeProductOverlay(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getProductOverlaySnapshot() {
  return clientSnapshot;
}

export function getProductOverlayServerSnapshot() {
  return serverSnapshot;
}

export function isProductOverlayOpen() {
  return frame !== null;
}

export function getProductOverlayBackgroundPath() {
  if (!background || typeof window === 'undefined') return null;
  try {
    const url = new URL(background.url, window.location.origin);
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

export function productTargetFromHref(href: string, base = 'https://primehubmall.com') {
  let url: URL;
  let baseUrl: URL;
  try {
    baseUrl = new URL(base);
    url = new URL(href, baseUrl);
  } catch {
    return null;
  }
  if (url.origin !== baseUrl.origin) return null;
  if (!url.pathname.startsWith('/product/')) return null;
  const raw = url.pathname.slice('/product/'.length).split('/')[0] || '';
  if (!raw) return null;
  let id = raw;
  try {
    id = decodeURIComponent(raw);
  } catch {
    return null;
  }
  id = id.trim();
  if (!id) return null;
  const bigDeal = url.searchParams.get('deal') === 'big';
  return { id, href: `${url.pathname}${url.search}`, bigDeal };
}

export function productBackAction(input: {
  overlayOpen: boolean;
  referrer: string;
  historyLength: number;
  origin: string;
}) {
  if (input.overlayOpen) return 'overlay-back' as const;
  const referrer = input.referrer || '';
  if (referrer.startsWith(input.origin) && input.historyLength > 1) return 'history-back' as const;
  return 'home' as const;
}

export function openProductOverlay(next: ProductOverlayFrame) {
  if (typeof window === 'undefined') return;
  installProductOverlayHistoryListener();
  if (!background) {
    background = {
      state: window.history.state,
      url: `${window.location.pathname}${window.location.search}${window.location.hash}`,
    };
    window.history.pushState({ __phProductOverlay: true }, '', next.href);
  } else {
    window.history.replaceState({ __phProductOverlay: true }, '', next.href);
  }
  frame = next;
  emit();
}

export function closeProductOverlayFromPop() {
  frame = null;
  background = null;
  emit();
}

export function navigateFromProductOverlay(href: string) {
  if (!frame || typeof window === 'undefined') return false;
  pendingNavigation = href;
  window.history.back();
  return true;
}

function onOverlayPopState(event: PopStateEvent) {
  if (!frame) return;
  event.stopImmediatePropagation();
  const next = pendingNavigation;
  pendingNavigation = null;
  closeProductOverlayFromPop();
  if (!next) return;
  window.dispatchEvent(new CustomEvent('ph-overlay-navigate', { detail: next }));
}

export function installProductOverlayHistoryListener() {
  if (popListenerInstalled || typeof window === 'undefined') return;
  popListenerInstalled = true;
  window.addEventListener('popstate', onOverlayPopState, true);
}
