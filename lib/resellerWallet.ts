export type WithdrawalMethod = 'easypaisa' | 'jazzcash' | 'bank';
export type WithdrawalStatus = 'pending' | 'approved' | 'paid' | 'rejected';

export interface WithdrawalRequest {
  id: string;
  userId: string;
  amount: number;
  method: WithdrawalMethod;
  accountTitle: string;
  accountNumber: string;
  status: WithdrawalStatus;
  createdAt: unknown;
  reviewedAt?: unknown;
  paidAt?: unknown;
  adminNote?: string;
}

export interface WalletSummary {
  available: number;
  pending: number;
  totalEarned: number;
  totalWithdrawn: number;
}

export const MIN_WITHDRAWAL_AMOUNT = 500;

export function validateWithdrawalAmount(amount: number, availableBalance: number): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return 'Enter a valid withdrawal amount.';
  if (amount < MIN_WITHDRAWAL_AMOUNT) return `Minimum withdrawal is Rs. ${MIN_WITHDRAWAL_AMOUNT}.`;
  if (amount > availableBalance) return 'Withdrawal amount cannot exceed your available balance.';
  return null;
}
