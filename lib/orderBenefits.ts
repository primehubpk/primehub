/** Calculations for cash wallet and vouchers. Never trust cart-supplied deal flags. */
export type BenefitItem = { productId: string; price: number; quantity: number; weeklyDealDay?: string | null; rewardExcluded?: boolean };
export type BenefitSettings = { bigDeal?: any; dailyDeal?: any; weeklyDeals?: any[] };

export function orderEligibleSubtotal(items: BenefitItem[], settings: BenefitSettings) {
  // Every product *assigned* to an active Admin Big Deal or Weekly Deal is
  // excluded, including locked future days. Deals never stack with wallet
  // deductions, cashback or checkout vouchers, even at the regular price.
  // IDs are sourced from server-side Admin settings, not cart-supplied flags.
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
    if (excluded.has(String(item.productId)) || item.weeklyDealDay || item.rewardExcluded) return sum;
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
