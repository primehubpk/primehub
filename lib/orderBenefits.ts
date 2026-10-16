/** Calculations for cash wallet and vouchers. Never trust cart-supplied deal flags. */
export type BenefitItem = { productId: string; price: number; quantity: number; weeklyDealDay?: string | null; rewardExcluded?: boolean };
export type BenefitSettings = { dailyDeal?: any; weeklyDeals?: any[] };

export function orderEligibleSubtotal(items: BenefitItem[], settings: BenefitSettings) {
  const excluded = new Set<string>();
  const weekly = Array.isArray(settings.weeklyDeals) ? settings.weeklyDeals : [];
  // Exclude all products currently assigned to enabled special-deal sections,
  // including off-day or rotating Big Deal slots, avoiding double promotions.
  for (const row of weekly) if (row?.active !== false && row?.productId) excluded.add(String(row.productId));
  const big = settings.dailyDeal;
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
