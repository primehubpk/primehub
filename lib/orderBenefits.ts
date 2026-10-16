/** Calculations for cash wallet and vouchers. Never trust cart-supplied deal flags. */
export type BenefitItem = { productId: string; price: number; quantity: number; weeklyDealDay?: string | null; rewardExcluded?: boolean };
export type BenefitSettings = { dailyDeal?: any; weeklyDeals?: any[] };

export function orderEligibleSubtotal(items: BenefitItem[], settings: BenefitSettings) {
  // Only verified special-deal prices are ineligible. Do not punish customers
  // who buy a scheduled weekly/rotating Big Deal item at its ordinary price.
  // The order API sets rewardExcluded based on authoritative Admin deal data.
  return items.reduce((sum, item) => {
    if (item.weeklyDealDay || item.rewardExcluded) return sum;
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
