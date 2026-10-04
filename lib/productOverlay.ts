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
  commercePath: string | null;
};

const listeners = new Set<() => void>();
let frame: ProductOverlayFrame | null = null;
let background: BackgroundEntry | null = null;
let commercePaths: string[] = [];
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

function armSwallow(fallback?: () => void) {
  swallowNextPop = true;
  if (typeof window === 'undefined') return;
  window.clearTimeout(swallowTimer);
  // If the browser never emits popstate, forget the swallow so the next
  // real back tap is not eaten.
  swallowTimer = window.setTimeout(() => {
    swallowNextPop = false;
    fallback?.();
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

const serverSnapshot: OverlaySnapshot = { frame: null, commercePath: null };
let clientSnapshot: OverlaySnapshot = { frame: null, commercePath: null };

function emit() {
  clientSnapshot = { frame, commercePath: commercePaths.at(-1) || null };
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
  if (commercePaths.length) {
    navigateFromProductOverlay(next.href);
    return;
  }
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
  commercePaths = [];
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
  const historySteps = commercePaths.length + 1;
  commercePaths = [];
  const hadHistory = overlayHistory;
  overlayHistory = false;
  emit();
  if (!previous || typeof window === 'undefined') {
    rememberScroll(scrollY);
    unlockScrollRestoration();
    return;
  }
  if (hadHistory) {
    // Remove the one entry created on open. Replacing it with the list URL
    // accumulated duplicate list entries and made repeated Back taps seem stuck.
    pendingScrollY = scrollY;
    armSwallow(() => {
      if (window.location.pathname.startsWith('/product/')) rawReplaceState(previous.state, previous.url);
      pendingScrollY = null;
      unlockScrollRestoration();
    });
    if (historySteps > 1) window.history.go(-historySteps);
    else window.history.back();
    rememberScroll(scrollY);
    return;
  }
  rawReplaceState(previous.state, previous.url);
  rememberScroll(scrollY);
  unlockScrollRestoration();
}

export function navigateFromProductOverlay(href: string) {
  if (!frame || typeof window === 'undefined') return false;
  if (href === '/cart' || href === '/checkout') {
    if (commercePaths.at(-1) !== href) {
      commercePaths.push(href);
      rawPushState({ __phCommercePaths: [...commercePaths] }, href);
      emit();
    }
    return true;
  }
  commercePaths = [];
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

export function returnFromCommerceOverlay() {
  if (!frame || !commercePaths.length || typeof window === 'undefined') return false;
  window.history.go(-commercePaths.length);
  return true;
}

function onOverlayPopState(event: PopStateEvent) {
  if (frame && (commercePaths.length || event.state?.__phCommercePaths)) {
    const path = `${window.location.pathname}${window.location.search}`;
    event.stopImmediatePropagation();
    if (path === frame.href) {
      commercePaths = [];
      emit();
      return;
    }
    const storedPaths = event.state?.__phCommercePaths;
    if (Array.isArray(storedPaths) && storedPaths.every(value => value === '/cart' || value === '/checkout') && storedPaths.at(-1) === path) {
      commercePaths = storedPaths;
      emit();
      return;
    }
    const index = commercePaths.lastIndexOf(path);
    if (index >= 0) {
      commercePaths = commercePaths.slice(0, index + 1);
      emit();
      return;
    }
  }
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
  window.addEventListener('ph-home-top', cancelScrollRestore);
}
