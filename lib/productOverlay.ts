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
let swallowNextPop = false;
let overlayHistory = false;

// Next.js replaces window.history.pushState and treats that as a real page
// change. That fetches the product route (white screen) and makes back wait
// on the server. The original History methods only update the address bar.
function rawPushState(data: unknown, url: string) {
  const push = typeof History === 'undefined' ? window.history.pushState : History.prototype.pushState;
  push.call(window.history, data, '', url);
}

function rawReplaceState(data: unknown, url: string) {
  const replace = typeof History === 'undefined' ? window.history.replaceState : History.prototype.replaceState;
  replace.call(window.history, data, '', url);
}

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
    rawPushState(null, next.href);
    overlayHistory = true;
  } else {
    rawReplaceState(null, next.href);
  }
  frame = next;
  emit();
}

export function closeProductOverlayFromPop() {
  frame = null;
  background = null;
  overlayHistory = false;
  emit();
}

// Hide the product in this same tap. The list underneath never unmounted, so
// the customer is back on the same picture and the same scroll immediately.
export function closeProductOverlayNow() {
  if (!frame && !background) return;
  const shouldPop = overlayHistory;
  frame = null;
  background = null;
  overlayHistory = false;
  emit();
  if (!shouldPop || typeof window === 'undefined') return;
  swallowNextPop = true;
  window.history.back();
}

export function navigateFromProductOverlay(href: string) {
  if (!frame || typeof window === 'undefined') return false;
  const previous = background;
  frame = null;
  background = null;
  overlayHistory = false;
  emit();
  if (previous) rawReplaceState(previous.state, previous.url);
  window.dispatchEvent(new CustomEvent('ph-overlay-navigate', { detail: href }));
  return true;
}

function onOverlayPopState(event: PopStateEvent) {
  if (!frame && !swallowNextPop) return;
  event.stopImmediatePropagation();
  const swallowing = swallowNextPop;
  swallowNextPop = false;
  if (swallowing) return;
  closeProductOverlayFromPop();
}

export function installProductOverlayHistoryListener() {
  if (popListenerInstalled || typeof window === 'undefined') return;
  popListenerInstalled = true;
  window.addEventListener('popstate', onOverlayPopState, true);
}
