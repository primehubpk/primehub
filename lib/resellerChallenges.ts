export type ResellerChallengeRewardType = 'cash' | 'gift';
export type ResellerTaskType = 'youtube' | 'instagram' | 'tiktok' | 'share';

export interface MonthlyResellerChallenge {
  id: string;
  title: string;
  description: string;
  targetOrders: number;
  rewardType: ResellerChallengeRewardType;
  cashAmount?: number;
  giftTitle?: string;
  enabled: boolean;
}

export interface ResellerSocialTask {
  id: string;
  type: ResellerTaskType;
  title: string;
  description: string;
  points: number;
  url?: string;
  enabled: boolean;
  verification: 'manual' | 'link_click' | 'admin';
}

export const DEFAULT_MONTHLY_CHALLENGE: MonthlyResellerChallenge = {
  id: 'monthly-10-orders',
  title: 'PrimeHub Monthly Challenge',
  description: 'Complete 10 eligible orders this month and unlock your reward.',
  targetOrders: 10,
  rewardType: 'cash',
  cashAmount: 1000,
  enabled: true,
};

export const DEFAULT_RESELLER_TASKS: ResellerSocialTask[] = [
  { id: 'youtube', type: 'youtube', title: 'Subscribe on YouTube', description: 'Join the PrimeHub YouTube community.', points: 50, enabled: true, verification: 'link_click' },
  { id: 'instagram', type: 'instagram', title: 'Follow on Instagram', description: 'Follow PrimeHub for new deals and updates.', points: 50, enabled: true, verification: 'link_click' },
  { id: 'tiktok', type: 'tiktok', title: 'Follow on TikTok', description: 'Follow PrimeHub on TikTok.', points: 50, enabled: true, verification: 'link_click' },
  { id: 'share', type: 'share', title: 'Share PrimeHub', description: 'Share PrimeHub with your friends.', points: 100, enabled: true, verification: 'admin' },
];

export function getChallengeProgress(orderCount: number, target: number) {
  const safeTarget = Math.max(1, target);
  return { completed: orderCount >= safeTarget, percent: Math.min(100, Math.round((orderCount / safeTarget) * 100)), remaining: Math.max(0, safeTarget - orderCount) };
}
