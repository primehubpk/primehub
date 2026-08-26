import { getTierForMonthlyOrders } from './resellerTiers';

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
  const tier = getTierForMonthlyOrders(monthlyOrdersBeforeOrder + 1);
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
  return orders.filter((order) => order.resellerEligible !== false && order.status === 'delivered' && order.subtotal > 0).length;
}
