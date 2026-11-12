/** One sellable offer pack contains one paid pack and one identical free pack.
 * Stock and the existing delivery threshold count OFFER packs, not bonus units. */
export type BogoSettings = { enabled: boolean; heading: string; autoRenew: boolean; endsAt: string };
export type BogoPack = { enabled: boolean; unitLabel: string; unitsPerOffer: 2 };
export const DEFAULT_BOGO_SETTINGS: BogoSettings = {
  enabled: true, heading: 'Buy 1 Get 1 Free', autoRenew: true, endsAt: '',
};
export function resolveBogoSettings(raw?: Partial<BogoSettings> | null): BogoSettings {
  return { enabled: raw?.enabled !== false,
    heading: String(raw?.heading || DEFAULT_BOGO_SETTINGS.heading).trim().slice(0, 80),
    autoRenew: raw?.autoRenew !== false, endsAt: String(raw?.endsAt || '').trim() };
}
/** Next Pakistan midnight. Timer rolls over; inventory is never reset. */
export function bogoWindow(raw?: Partial<BogoSettings> | null, now = Date.now()) {
  const settings = resolveBogoSettings(raw);
  const offset = 5 * 60 * 60 * 1000;
  const midnight = (Math.floor((now + offset) / 86400000) + 1) * 86400000 - offset;
  const endsAt = settings.autoRenew ? midnight : Date.parse(settings.endsAt);
  return { live: settings.enabled && Number.isFinite(endsAt) && endsAt > now,
    endsAt, remaining: Math.max(0, Math.ceil((endsAt - now) / 1000)) || 0 };
}
export function isBogoProduct(product: any): boolean {
  return product?.bogoOffer?.enabled === true && product.bogoOffer.unitsPerOffer === 2;
}
export function bogoFulfilment(product: any, quantity: number) {
  return isBogoProduct(product) ? { type: 'buy-one-get-one-free' as const,
    paidPacks: quantity, freePacks: quantity, totalPacks: quantity * 2,
    unitLabel: String(product.bogoOffer.unitLabel || 'pack'), sameVariant: true } : null;
}
/** Require an exact active saved size and shared stock budget across cart lines. */
export function validateBogoOrder(product: any, selection: any, quantity: number,
  settings: Partial<BogoSettings> | undefined, used: Map<string, number>, now = Date.now()) {
  if (!isBogoProduct(product)) return;
  if (!bogoWindow(settings, now).live || product.active === false || product.published === false) {
    throw new Error('This Buy 1 Get 1 Free offer is not currently live.');
  }
  const rows = Array.isArray(product.variantMatrix) && product.variantMatrix.length
    ? product.variantMatrix : Array.isArray(product.variants) ? product.variants : [];
  const key = (value: unknown) => String(value || '').trim().toLowerCase();
  const row = rows.length ? rows.find((item: any) => item.active !== false && item.hidden !== true &&
    key(item.size) === key(selection?.size) && key(item.color) === key(selection?.color)) : null;
  if (rows.length && !row) throw new Error('Select an available size for this offer.');
  const raw = row?.stock ?? product.stock;
  const stock = raw == null || raw === '' ? 30 : Number(raw);
  const stockKey = String(product.id) + ':' + (row?.id || key(row?.color) + ':' + key(row?.size));
  const requested = (used.get(stockKey) || 0) + quantity;
  if (!Number.isFinite(stock) || requested > stock) throw new Error('Not enough offer packs in stock for your selected size.');
  // Parent inventory is also a cap shared by all sizes.
  const parentKey = String(product.id) + ':__all__';
  const parentRequested = (used.get(parentKey) || 0) + quantity;
  const parentStock = product.stock == null || product.stock === '' ? 30 : Number(product.stock);
  if (!Number.isFinite(parentStock) || parentRequested > parentStock) throw new Error('Not enough offer packs in stock.');
  used.set(stockKey, requested); used.set(parentKey, parentRequested);
}

export function applyBogoAvailability<T extends Record<string, any>>(product: T, settings?: Partial<BogoSettings>): T {
  return isBogoProduct(product) && !bogoWindow(settings).live
    ? { ...product, active: false, published: false, stock: 0 } : product;
}
