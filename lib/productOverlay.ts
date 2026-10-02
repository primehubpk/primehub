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
  scrollY: number;
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
let pendingScrollY: number | null = null;
let scrollGeneration = 0;
let savedScrollRestoration: ScrollRestoration | null = null;
let clickClaimed = false;
let swallowTimer = 0;

const RETURN_PATH_KEY = 'ph-return-path';

type ScrollRestoration = 'auto' | 'manual';

function currentScrollY() {
  if (typeof window === 'undefined') return 0;
  return window.scrollY || window.pageYOffset || 0;
}

function lockScrollRestoration() {
  if (savedScrollRestoration !== null || typeof window === 'undefined') return;
  try {
    savedScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
  } catch {
    savedScrollRestoration = 'auto';
  }
}

function unlockScrollRestoration() {
  if (savedScrollRestoration === null || typeof window === 'undefined') return;
  const previous = savedScrollRestoration;
  savedScrollRestoration = null;
  try {
    window.history.scrollRestoration = previous;
  } catch {
    // Some webviews do not expose scroll restoration.
  }
}

// The address-bar update can jump the page to the top. Put the shopper back
// on the same pixel, including the frame after the browser applies history.
function rememberScroll(y: number) {
  if (typeof window === 'undefined') return;
  const generation = ++scrollGeneration;
  const apply = () => {
    if (generation !== scrollGeneration || typeof window === 'undefined') return;
    if (currentScrollY() !== y) window.scrollTo(0, y);
  };
  apply();
  window.requestAnimationFrame(apply);
  window.setTimeout(apply, 0);
  window.setTimeout(apply, 60);
}

function cancelScrollRestore() {
  scrollGeneration += 1;
  pendingScrollY = null;
}

function armSwallow() {
  swallowNextPop = true;
  if (typeof window === 'undefined') return;
  window.clearTimeout(swallowTimer);
  // If the browser never emits popstate, forget the swallow so the next
  // real back tap is not eaten.
  swallowTimer = window.setTimeout(() => {
    swallowNextPop = false;
  }, 600);
}

function clearSwallow() {
  swallowNextPop = false;
  if (typeof window !== 'undefined') window.clearTimeout(swallowTimer);
}

function rememberReturnPath(url: string) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(RETURN_PATH_KEY, url);
  } catch {
    // Private mode can block storage. The in-memory overlay still returns.
  }
}

export function readReturnPath() {
  if (typeof window === 'undefined') return '';
  try {
    return window.sessionStorage.getItem(RETURN_PATH_KEY) || '';
  } catch {
    return '';
  }
}

export function clearReturnPath() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(RETURN_PATH_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function resetStorefrontClickClaim() {
  clickClaimed = false;
}

export function claimStorefrontClick() {
  clickClaimed = true;
}

export function storefrontClickClaimed() {
  return clickClaimed;
}

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
    lockScrollRestoration();
    const scrollY = currentScrollY();
    background = {
      state: window.history.state,
      url: `${window.location.pathname}${window.location.search}${window.location.hash}`,
      scrollY,
    };
    rawPushState(null, next.href);
    overlayHistory = true;
    rememberReturnPath(background.url);
    rememberScroll(scrollY);
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
  const previous = background;
  const scrollY = previous?.scrollY ?? currentScrollY();
  frame = null;
  background = null;
  overlayHistory = false;
  emit();
  if (!previous || typeof window === 'undefined') {
    rememberScroll(scrollY);
    unlockScrollRestoration();
    return;
  }
  // Restore the address bar without history.back(). A real tap's history.back()
  // races Next.js: the product route stays on screen, and the next New Arrivals
  // arrow is swallowed too. The list underneath never unmounted.
  clearSwallow();
  rawReplaceState(previous.state, previous.url);
  rememberScroll(scrollY);
  unlockScrollRestoration();
}

export function navigateFromProductOverlay(href: string) {
  if (!frame || typeof window === 'undefined') return false;
  cancelScrollRestore();
  const previous = background;
  frame = null;
  background = null;
  overlayHistory = false;
  emit();
  if (previous) rawReplaceState(previous.state, previous.url);
  unlockScrollRestoration();
  window.dispatchEvent(new CustomEvent('ph-overlay-navigate', { detail: href }));
  return true;
}

function backgroundPathname() {
  const backgroundPath = getProductOverlayBackgroundPath();
  if (!backgroundPath || typeof window === 'undefined') return '';
  try {
    return new URL(backgroundPath, window.location.origin).pathname;
  } catch {
    return '';
  }
}

// One decision for every "Back to Home" control. The caller navigates only
// when this returns router-home, so a weekly deal cannot stop on the deals list.
export function requestStorefrontHome(): 'overlay-home' | 'pushed-home' | 'router-home' | 'scroll-top' {
  if (typeof window === 'undefined') return 'scroll-top';
  if (isProductOverlayOpen()) {
    if (backgroundPathname() === '/') {
      closeProductOverlayNow();
      return 'overlay-home';
    }
    if (navigateFromProductOverlay('/')) return 'pushed-home';
  }
  if (window.location.pathname === '/' && !window.location.search) return 'scroll-top';
  return 'router-home';
}

function onOverlayPopState(event: PopStateEvent) {
  if (!frame && !swallowNextPop) return;
  event.stopImmediatePropagation();
  const swallowing = swallowNextPop;
  clearSwallow();
  const scrollY = pendingScrollY ?? background?.scrollY ?? currentScrollY();
  pendingScrollY = null;
  if (!swallowing) closeProductOverlayFromPop();
  rememberScroll(scrollY);
  unlockScrollRestoration();
}

export function installProductOverlayHistoryListener() {
  if (popListenerInstalled || typeof window === 'undefined') return;
  popListenerInstalled = true;
  window.addEventListener('popstate', onOverlayPopState, true);
}
