type CacheableProduct = { id?: unknown; [key: string]: unknown };
type CacheableCategory = { id?: unknown; [key: string]: unknown };

type CatalogNavigationSnapshot = {
  products: CacheableProduct[];
  categories: CacheableCategory[];
  updatedAt: number;
};

type PrimeHubWindow = Window &
  typeof globalThis & {
    __primehubProductNavigationCache?: Record<string, CacheableProduct>;
    __primehubCatalogNavigationCache?: CatalogNavigationSnapshot;
  };

const pendingProductLoads = new Map<string, Promise<CacheableProduct | null>>();

function cacheStore() {
  if (typeof window === 'undefined') return null;
  const target = window as PrimeHubWindow;
  if (!target.__primehubProductNavigationCache) {
    target.__primehubProductNavigationCache = {};
  }
  return target.__primehubProductNavigationCache;
}

function normalizeIds(ids: string[] | null | undefined) {
  return Array.from(
    new Set(
      (Array.isArray(ids) ? ids : [])
        .map((id) => String(id || '').trim())
        .filter(Boolean),
    ),
  );
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

export function cacheCatalogForNavigation(
  products: CacheableProduct[] | null | undefined,
  categories: CacheableCategory[] | null | undefined,
) {
  if (typeof window === 'undefined') return;

  const target = window as PrimeHubWindow;
  const existing = target.__primehubCatalogNavigationCache;
  const nextProducts = Array.isArray(products) && products.length > 0
    ? products
    : existing?.products || [];
  const nextCategories = Array.isArray(categories) && categories.length > 0
    ? categories
    : existing?.categories || [];

  if (nextProducts.length === 0 && nextCategories.length === 0) return;

  cacheProductCatalog(nextProducts);
  target.__primehubCatalogNavigationCache = {
    products: nextProducts,
    categories: nextCategories,
    updatedAt: Date.now(),
  };
}

export function readCachedCatalog<
  TProduct extends CacheableProduct = CacheableProduct,
  TCategory extends CacheableCategory = CacheableCategory,
>() {
  if (typeof window === 'undefined') return null;
  const snapshot = (window as PrimeHubWindow).__primehubCatalogNavigationCache;
  if (!snapshot) return null;

  return {
    products: [...snapshot.products] as TProduct[],
    categories: [...snapshot.categories] as TCategory[],
    updatedAt: snapshot.updatedAt,
  };
}

export function readCachedProduct<T extends CacheableProduct = CacheableProduct>(id: string): T | null {
  const store = cacheStore();
  const key = String(id || '').trim();
  if (!store || !key) return null;
  return (store[key] as T | undefined) || null;
}

export function readCachedProducts<T extends CacheableProduct = CacheableProduct>(): T[] {
  const store = cacheStore();
  if (!store) return [];
  return Object.values(store) as T[];
}

async function fetchProductBatch(ids: string[]) {
  const response = await fetch(
    `/api/storefront/read?type=products&ids=${encodeURIComponent(JSON.stringify(ids))}`,
    { cache: 'no-store' },
  );
  if (!response.ok) return {} as Record<string, CacheableProduct>;

  const data = await response.json();
  const products = Array.isArray(data?.products) ? data.products as CacheableProduct[] : [];
  const found: Record<string, CacheableProduct> = {};
  for (const product of products) {
    const id = String(product?.id ?? '').trim();
    if (!id) continue;
    found[id] = product;
    cacheProductForNavigation(product);
  }
  return found;
}

export async function loadProductsForNavigation<T extends CacheableProduct = CacheableProduct>(
  ids: string[] | null | undefined,
): Promise<Record<string, T>> {
  const requested = normalizeIds(ids);
  if (requested.length === 0) return {};

  const missing = requested.filter((id) => !readCachedProduct(id));
  const fresh = missing.filter((id) => !pendingProductLoads.has(id));

  if (fresh.length > 0) {
    const batch = fetchProductBatch(fresh).catch(() => ({} as Record<string, CacheableProduct>));
    for (const id of fresh) {
      const pending = batch.then((products) => products[id] || null);
      pendingProductLoads.set(id, pending);
      void pending.finally(() => {
        if (pendingProductLoads.get(id) === pending) pendingProductLoads.delete(id);
      });
    }
  }

  if (missing.length > 0) {
    await Promise.all(
      missing.map((id) => pendingProductLoads.get(id) || Promise.resolve(null)),
    );
  }

  const resolved: Record<string, T> = {};
  for (const id of requested) {
    const product = readCachedProduct<T>(id);
    if (product) resolved[id] = product;
  }
  return resolved;
}
