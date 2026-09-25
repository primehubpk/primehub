// Share public reads across mounted components and route transitions. Never use
// this cache for carts, orders, customer data or purchase-time product checks.
export type PublicReadType = 'catalog' | 'categories' | 'settings' | 'skills' | 'rewards';
const responses = new Map<PublicReadType, { response: Response; expiresAt: number }>();
const pending = new Map<PublicReadType, Promise<Response>>();
const generations = new Map<PublicReadType, number>();
const refreshNext = new Set<PublicReadType>();
const TTL_MS = 60_000;

export function invalidatePublicStorefront(type?: PublicReadType) {
  const types: PublicReadType[] = type ? [type] : ['catalog', 'categories', 'settings', 'skills', 'rewards'];
  for (const key of types) {
    responses.delete(key);
    pending.delete(key);
    generations.set(key, (generations.get(key) || 0) + 1);
    refreshNext.add(key);
  }
}

export async function fetchPublicStorefront(type: PublicReadType): Promise<Response> {
  const cached = responses.get(type);
  if (cached && cached.expiresAt > Date.now()) return cached.response.clone();
  let request = pending.get(type);
  if (!request) {
    const generation = generations.get(type) || 0;
    const refresh = refreshNext.delete(type) ? '&refresh=1' : '';
    request = fetch(`/api/storefront/read?type=${type}${refresh}`, { cache: 'no-store', signal: AbortSignal.timeout(10_000) })
      .then((response) => {
        if (response.ok && generation === (generations.get(type) || 0)) {
          responses.set(type, { response: response.clone(), expiresAt: Date.now() + TTL_MS });
        }
        return response;
      });
    pending.set(type, request);
  }
  try {
    return (await request).clone();
  } finally {
    if (pending.get(type) === request) pending.delete(type);
  }
}
