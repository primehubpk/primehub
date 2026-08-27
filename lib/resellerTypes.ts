export type ResellerTierId = 'starter' | 'prime' | 'pro' | 'elite';

export interface ResellerTier {
  id: ResellerTierId;
  name: string;
  minMonthlyOrders: number;
  rewardPercent: number;
}

export interface ResellerProfile {
  userId: string;
  email: string;
  displayName: string;
  status: 'active' | 'suspended';
  tierId: ResellerTierId;
  monthlyOrders: number;
  walletAvailable: number;
  walletPending: number;
  createdAt: unknown;
  updatedAt: unknown;
}

export const DEFAULT_RESELLER_TIERS: ResellerTier[] = [
  { id: 'starter', name: 'Starter', minMonthlyOrders: 5, rewardPercent: 5 },
  { id: 'prime', name: 'Prime', minMonthlyOrders: 10, rewardPercent: 10 },
  { id: 'pro', name: 'Pro', minMonthlyOrders: 20, rewardPercent: 15 },
  { id: 'elite', name: 'Elite', minMonthlyOrders: 30, rewardPercent: 20 },
];
