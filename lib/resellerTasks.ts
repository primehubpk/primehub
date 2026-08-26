export type ResellerTask = {
  id: string;
  title: string;
  description: string;
  icon: string;
  url?: string;
  reward: number;
  active: boolean;
  verification: 'manual' | 'link';
};

export const DEFAULT_RESELLER_TASKS: ResellerTask[] = [
  { id: 'youtube', title: 'Subscribe on YouTube', description: 'Subscribe to PrimeHub and submit your completion for review.', icon: '▶', reward: 0, active: true, verification: 'manual' },
  { id: 'instagram', title: 'Follow on Instagram', description: 'Follow PrimeHub on Instagram and submit your completion.', icon: '◎', reward: 0, active: true, verification: 'manual' },
  { id: 'tiktok', title: 'Follow on TikTok', description: 'Follow PrimeHub on TikTok and submit your completion.', icon: '♪', reward: 0, active: true, verification: 'manual' },
  { id: 'share', title: 'Share PrimeHub', description: 'Share PrimeHub with friends and submit your completion.', icon: '↗', reward: 0, active: true, verification: 'manual' },
];

export type MonthlyChallengeSettings = {
  targetOrders: number;
  giftTitle: string;
  cashReward: number;
  active: boolean;
};

export const DEFAULT_MONTHLY_CHALLENGE: MonthlyChallengeSettings = {
  targetOrders: 10,
  giftTitle: 'PrimeHub Special Gift',
  cashReward: 1000,
  active: true,
};
