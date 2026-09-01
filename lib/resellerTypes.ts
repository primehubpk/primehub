export type ResellerTierId = 'starter' | 'prime' | 'pro' | 'elite';

export interface ResellerTier {
  id: ResellerTierId;
  name: string;
  minMonthlyOrders: number;
  rewardPercent: number;
  discountPercent?: number;
  benefits?: string[];
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
  { id: 'starter', name: 'Starter', minMonthlyOrders: 0, rewardPercent: 5, discountPercent: 0, benefits: ['Member-only prices', 'Earn points on tasks', 'Access club rewards'] },
  { id: 'prime', name: 'Silver', minMonthlyOrders: 10, rewardPercent: 10, discountPercent: 2, benefits: ['2% shopping discount', 'Priority reward access', 'Silver member badge'] },
  { id: 'pro', name: 'Gold', minMonthlyOrders: 20, rewardPercent: 15, discountPercent: 5, benefits: ['5% shopping discount', 'Bonus reward points', 'Gold member offers'] },
  { id: 'elite', name: 'Premium', minMonthlyOrders: 30, rewardPercent: 20, discountPercent: 8, benefits: ['8% shopping discount', 'Premium gift access', 'Top priority benefits'] },
];

