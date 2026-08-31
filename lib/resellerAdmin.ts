import type { ResellerTier } from './resellerTypes';
import type { MonthlyResellerChallenge, ResellerSocialTask } from './resellerChallenges';
import { MIN_WITHDRAWAL_AMOUNT } from './resellerWallet';

export interface ResellerAdminSettings {
  enabled: boolean;
  tiers: ResellerTier[];
  minWithdrawalAmount: number;
  monthlyChallenge: MonthlyResellerChallenge;
  socialTasks: ResellerSocialTask[];
}

export const DEFAULT_RESELLER_ADMIN_SETTINGS: Omit<ResellerAdminSettings, 'tiers' | 'monthlyChallenge' | 'socialTasks'> = {
  enabled: true,
  minWithdrawalAmount: MIN_WITHDRAWAL_AMOUNT,
};
