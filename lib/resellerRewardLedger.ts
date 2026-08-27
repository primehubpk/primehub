export type ResellerRewardStatus = 'pending' | 'available' | 'reversed';

export interface ResellerRewardLedgerEntry {
  id: string;
  userId: string;
  orderId: string;
  tierId: 'starter' | 'prime' | 'pro' | 'elite';
  rewardPercent: number;
  baseAmount: number;
  rewardAmount: number;
  status: ResellerRewardStatus;
  createdAt: unknown;
  availableAt?: unknown;
  reversedAt?: unknown;
  reversalReason?: string;
}

/**
 * Reward ledger records should be append-only from the client perspective.
 * Creation/availability/reversal must be performed by trusted server/admin code.
 */
