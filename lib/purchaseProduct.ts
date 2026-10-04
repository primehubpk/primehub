import type { VariantModalProduct } from './cartStore';
import { cacheProductForNavigation } from './productNavigationCache';

const pending = new Map<string, Promise<VariantModalProduct>>();

// Card/navigation snapshots can omit variants. Only a purchase-time read can
// decide whether an item can be added without a customer's size/color choice.
export function loadProductForPurchase(id: string): Promise<VariantModalProduct> {
  const existing = pending.get(id);
  if (existing) return existing;
  const request = (async () => {
    const response = await fetch(`/api/storefront/read?type=product&id=${encodeURIComponent(id)}`, {
      cache: 'no-store', signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('Unable to check product options. Please try again.');
    const data = await response.json();
    if (!data?.product || String(data.product.id) !== id) throw new Error('This product is no longer available.');
    cacheProductForNavigation(data.product);
    return data.product as VariantModalProduct;
  })();
  pending.set(id, request);
  void request.finally(() => { if (pending.get(id) === request) pending.delete(id); }).catch(() => undefined);
  return request;
}
