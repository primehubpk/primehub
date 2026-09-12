export const CATALOG_REFRESH_EVENT = 'primehub:catalog-updated';

export type CatalogRefreshDetail = {
  action: string;
  collection: string;
  id?: string;
  at: string;
};

export function notifyCatalogUpdated(detail: CatalogRefreshDetail) {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(new CustomEvent(CATALOG_REFRESH_EVENT, { detail }));

  try {
    window.localStorage.setItem(CATALOG_REFRESH_EVENT, JSON.stringify(detail));
  } catch {
    // Storage can be unavailable in private/restricted browser contexts.
  }

  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(CATALOG_REFRESH_EVENT);
    channel.postMessage(detail);
    channel.close();
  }
}
