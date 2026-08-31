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
  { id: 'weekly-orders', title: '3 orders this week', description: 'Complete 3 eligible PrimeHub orders and claim a fast weekly bonus.', icon: '🛒', reward: 150, active: true, verification: 'manual' },
  { id: 'monthly-orders', title: '10 orders this month', description: 'Complete the monthly challenge and unlock gift or cash reward.', icon: '📅', reward: 1000, active: true, verification: 'manual' },
  { id: 'wholesale-order', title: 'First wholesale order', description: 'Place your first wholesale order and start selling with better margin.', icon: '📦', reward: 200, active: true, verification: 'manual' },
  { id: 'youtube', title: 'Subscribe on YouTube', description: 'Subscribe to PrimeHub and submit your completion for review.', icon: '▶', reward: 50, active: true, verification: 'manual' },
  { id: 'instagram', title: 'Follow on Instagram', description: 'Follow PrimeHub on Instagram and submit your username.', icon: '◎', reward: 50, active: true, verification: 'manual' },
  { id: 'tiktok', title: 'Follow on TikTok', description: 'Follow PrimeHub on TikTok and submit your username.', icon: '♪', reward: 50, active: true, verification: 'manual' },
  { id: 'whatsapp-share', title: 'Share on WhatsApp', description: 'Share PrimeHub products with 5 friends or groups and submit proof.', icon: '💬', reward: 75, active: true, verification: 'manual' },
  { id: 'refer-reseller', title: 'Refer a reseller', description: 'Invite one verified reseller to join PrimeHub Reseller Club.', icon: '🤝', reward: 300, active: true, verification: 'manual' },
];

export type MonthlyChallengeSettings = {
  targetOrders: number;
  giftTitle: string;
  cashReward: number;
  active: boolean;
};

export const DEFAULT_MONTHLY_CHALLENGE: MonthlyChallengeSettings = {
  targetOrders: 10,
  giftTitle: 'PrimeHub Gift Box',
  cashReward: 1000,
  active: true,
};
