import { getResellerTiers, getTierForMonthlyOrders } from './resellerTiers';

export type ResellerOrderStatus = 'pending' | 'confirmed' | 'delivered' | 'cancelled' | 'refunded';

export interface EligibleResellerOrder {
  orderId: string;
  status: ResellerOrderStatus;
  subtotal: number;
  resellerEligible?: boolean;
}

export interface RewardCalculation {
  eligible: boolean;
  reason: string;
  tierId: ReturnType<typeof getTierForMonthlyOrders>['id'];
  rewardPercent: number;
  rewardAmount: number;
}

const ELIGIBLE_STATUSES: ResellerOrderStatus[] = ['delivered'];

export function calculateResellerReward(order: EligibleResellerOrder, monthlyOrdersBeforeOrder: number): RewardCalculation {
  const safeMonthlyOrders = Math.max(0, Math.floor(Number(monthlyOrdersBeforeOrder) || 0));
  const tier = getTierForMonthlyOrders(safeMonthlyOrders + 1);
  const eligible = Boolean(order.resellerEligible !== false)
    && ELIGIBLE_STATUSES.includes(order.status)
    && Number.isFinite(order.subtotal)
    && order.subtotal > 0;

  if (!eligible) {
    return { eligible: false, reason: 'Order is not eligible for a reseller reward yet.', tierId: tier.id, rewardPercent: tier.rewardPercent, rewardAmount: 0 };
  }

  const rewardAmount = Math.round((order.subtotal * tier.rewardPercent) / 100);
  return { eligible: true, reason: 'Eligible delivered reseller order.', tierId: tier.id, rewardPercent: tier.rewardPercent, rewardAmount };
}

export function getEligibleOrderCount(orders: EligibleResellerOrder[]): number {
  return orders.filter((order) => order.resellerEligible !== false && order.status === 'delivered' && Number.isFinite(order.subtotal) && order.subtotal > 0).length;
}

/** UI-safe tier summary. It only calculates progress; it does not mutate a reseller account. */
export function getResellerTierSummary(monthlyOrders: number) {
  const safeMonthlyOrders = Math.max(0, Math.floor(Number(monthlyOrders) || 0));
  const tiers = getResellerTiers();
  const current = getTierForMonthlyOrders(safeMonthlyOrders);
  const currentIndex = tiers.findIndex((tier) => tier.id === current.id);
  const next = tiers[currentIndex + 1] ?? null;
  const progress = next
    ? Math.min(100, Math.max(0, Math.round(((safeMonthlyOrders - current.minMonthlyOrders) / Math.max(1, next.minMonthlyOrders - current.minMonthlyOrders)) * 100)))
    : 100;

  return {
    monthlyOrders: safeMonthlyOrders,
    current,
    next,
    progress,
    ordersToNext: next ? Math.max(0, next.minMonthlyOrders - safeMonthlyOrders) : 0,
  };
}
