import type { DealCollectionSource } from './glassOffers';

/** Calculations for cash wallet and vouchers. Never trust cart-supplied deal flags. */
export type BenefitItem = { productId: string; price: number; quantity: number; weeklyDealDay?: string | null; rewardExcluded?: boolean; dealCategory?: string; promotion?: { type?: string } | null };
export type BenefitSettings = DealCollectionSource;

export function orderEligibleSubtotal(items: BenefitItem[], settings: BenefitSettings) {
  // Mega/70%-style and BOGO PAID packs now qualify for cashback, wallet
  // spending and vouchers, just like regular products. Free BOGO packs have no
  // separately charged line. Only legacy Weekly/Big offers remain excluded.
  const excluded = new Set<string>();
  for (const deal of Array.isArray(settings.weeklyDeals) ? settings.weeklyDeals : []) {
    if (deal?.active !== false && deal?.productId) excluded.add(String(deal.productId));
  }
  const big = settings.bigDeal && typeof settings.bigDeal === 'object'
    ? settings.bigDeal : settings.dailyDeal;
  if (big?.active === true) {
    for (const id of [...(Array.isArray(big.productIds) ? big.productIds : []), big.productId]) {
      if (id) excluded.add(String(id));
    }
  }
  return items.reduce((sum, item) => {
    if (excluded.has(String(item.productId)) || item.weeklyDealDay || item.rewardExcluded ||
      ['weekly', 'big'].includes(String(item.dealCategory || ''))) return sum;
    const lineTotal = Number(item.price) * Number(item.quantity);
    if (!Number.isSafeInteger(lineTotal) || lineTotal < 0) throw new Error('Invalid eligible order amount.');
    if (!Number.isSafeInteger(sum + lineTotal)) throw new Error('Order total exceeds supported range.');
    return sum + lineTotal;
  }, 0);
}

export function cashBackForTier(eligibleAmount: number, percent: number) {
  if (!Number.isSafeInteger(eligibleAmount) || eligibleAmount < 0 ||
    !Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new Error('Invalid cashback calculation.');
  }
  return Math.round(eligibleAmount * percent / 100);
}
