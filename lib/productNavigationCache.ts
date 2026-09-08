type CacheableProduct = { id?: unknown; [key: string]: unknown };

type PrimeHubWindow = Window &
  typeof globalThis & {
    __primehubProductNavigationCache?: Record<string, CacheableProduct>;
  };

function cacheStore() {
  if (typeof window === 'undefined') return null;
  const target = window as PrimeHubWindow;
  if (!target.__primehubProductNavigationCache) {
    target.__primehubProductNavigationCache = {};
  }
  return target.__primehubProductNavigationCache;
}

export function cacheProductForNavigation(product: CacheableProduct | null | undefined) {
  const store = cacheStore();
  const id = String(product?.id ?? '').trim();
  if (!store || !id || !product) return;
  store[id] = product;
}

export function cacheProductCatalog(products: CacheableProduct[] | null | undefined) {
  if (!Array.isArray(products) || products.length === 0) return;
  const store = cacheStore();
  if (!store) return;
  for (const product of products) {
    const id = String(product?.id ?? '').trim();
    if (id) store[id] = product;
  }
}

export function readCachedProduct<T extends CacheableProduct = CacheableProduct>(id: string): T | null {
  const store = cacheStore();
  const key = String(id || '').trim();
  if (!store || !key) return null;
  return (store[key] as T | undefined) || null;
}
