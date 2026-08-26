import { DEFAULT_RESELLER_TIERS, ResellerTier, ResellerTierId } from './resellerTypes';

export function getResellerTiers(): ResellerTier[] {
  return DEFAULT_RESELLER_TIERS;
}

export function getTierForMonthlyOrders(monthlyOrders: number): ResellerTier {
  const tiers = getResellerTiers();
  return [...tiers].reverse().find((tier) => monthlyOrders >= tier.minMonthlyOrders) ?? tiers[0];
}

export function getNextTier(monthlyOrders: number): ResellerTier | null {
  const tiers = getResellerTiers();
  return tiers.find((tier) => tier.minMonthlyOrders > monthlyOrders) ?? null;
}

export function getTierProgress(monthlyOrders: number): { current: ResellerTierId; next: ResellerTier | null; remaining: number } {
  const current = getTierForMonthlyOrders(monthlyOrders);
  const next = getNextTier(monthlyOrders);
  return { current: current.id, next, remaining: next ? Math.max(0, next.minMonthlyOrders - monthlyOrders) : 0 };
}
