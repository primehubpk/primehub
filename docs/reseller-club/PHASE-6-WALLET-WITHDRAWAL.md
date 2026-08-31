# PrimeHub Reseller Club — Phase 6 Wallet & Withdrawal

## User flow
1. Eligible reward is released to `walletAvailable` after the configured review condition.
2. Reseller opens Wallet.
3. Reseller enters an amount and selects Easypaisa, JazzCash or Bank.
4. Account title and account number are submitted.
5. A `pending` withdrawal request is created.
6. Admin reviews it.
7. Admin can approve/reject; approved requests can then be marked paid.
8. User sees the complete withdrawal history.

## Rules
- Minimum withdrawal: Rs. 500 (admin-configurable later).
- Amount cannot exceed available balance.
- Pending rewards are not withdrawable.
- Client cannot directly increase wallet balance.
- Client cannot approve or mark a withdrawal as paid.
- A withdrawal request should reserve/debit the requested amount atomically to prevent double spending.
- Sensitive payout data should be restricted to the user and authorized admin roles.

## Phase boundary
Phase 6 adds the UI and contracts only. Actual Firestore writes, atomic balance reservation, admin approval actions, and production security rules will be implemented together with trusted backend/admin logic before real withdrawals are enabled.
