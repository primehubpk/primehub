'use client';

import type { TikTokEventPayload } from './tiktokPixel';

// Public dataset ID owned by the PRIME HUB business portfolio, not a credential.
export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || '1445705320818675';

type MetaTracker = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push: MetaTracker;
  loaded: boolean;
  version: string;
};

declare global {
  interface Window { fbq?: MetaTracker; _fbq?: MetaTracker }
}

let initialized = false;
let lastPage = '';
const purchaseIds = new Set<string>();

function tracker() {
  if (typeof window === 'undefined' || !/^\d+$/.test(META_PIXEL_ID)) return;
  if (!window.fbq) {
    const fbq = function (...args: unknown[]) {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue.push(args);
    } as MetaTracker;
    fbq.queue = [];
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = '2.0';
    window.fbq = window._fbq = fbq;
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(script);
  }
  if (!initialized) {
    window.fbq('init', META_PIXEL_ID);
    initialized = true;
  }
  return window.fbq;
}

export function trackMetaPageView() {
  try {
    if (typeof window === 'undefined') return;
    const page = window.location.pathname;
    if (page === lastPage || /^\/(admin|api|reseller)(\/|$)/.test(page)) return;
    const fbq = tracker();
    if (!fbq) return;
    fbq('trackSingle', META_PIXEL_ID, 'PageView');
    lastPage = page;
  } catch { /* Analytics must never interrupt shopping. */ }
}

const eventNames: Record<string, string> = {
  ViewContent: 'ViewContent', AddToCart: 'AddToCart',
  InitiateCheckout: 'InitiateCheckout', PlaceAnOrder: 'Purchase', Search: 'Search',
};

/** Reuse storefront events, preserving the exact IDs used by the Meta feed. */
export function trackMetaStoreEvent(name: string, payload?: TikTokEventPayload, eventId?: string) {
  try {
    const event = eventNames[name];
    if (!event || typeof window === 'undefined') return;
    if (/^\/(admin|api|reseller)(\/|$)/.test(window.location.pathname)) return;
    if (event === 'Purchase' && eventId && purchaseIds.has(eventId)) return;
    const fbq = tracker();
    if (!fbq) return;
    const contents = (payload?.contents || []).filter(item => item.content_id).map(item => ({
      id: item.content_id, quantity: item.num_items || 1,
      ...(item.price != null ? { item_price: item.price } : {}),
    }));
    fbq('trackSingle', META_PIXEL_ID, event, {
      ...(contents.length ? { content_type: 'product', content_ids: contents.map(item => item.id), contents,
        num_items: contents.reduce((sum, item) => sum + item.quantity, 0) } : {}),
      ...(payload?.value != null && Number.isFinite(payload.value) ? { value: payload.value, currency: payload.currency || 'PKR' } : {}),
      ...(payload?.search_string ? { search_string: payload.search_string } : {}),
    }, ...(eventId ? [{ eventID: eventId }] : []));
    if (event === 'Purchase' && eventId) purchaseIds.add(eventId);
  } catch { /* Analytics must never interrupt shopping. */ }
}
