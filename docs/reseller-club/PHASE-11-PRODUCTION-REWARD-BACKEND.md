# PrimeHub Reseller Club — Phase 11 Production Reward Backend

## Implemented
- Authenticated reseller checkout can optionally attach `resellerUserId` to an order; guest checkout remains unchanged.
- Trusted server reward service creates one pending ledger entry per order ID.
- Delivered reseller orders use the configured tier calculation and a 7-day reward hold.
- Matured pending rewards can be released server-side into `walletAvailable`.
- Withdrawal creation uses an atomic server transaction to reserve/debit available wallet balance before creating the request.
- Admin review supports pending -> approved -> paid and rejection refunds the reserved amount.
- Admin-only reward processing endpoint and user-authenticated reward release/withdrawal endpoints are included.

## Critical production checks
- Keep `FIREBASE_SERVICE_ACCOUNT_KEY` only in server/Vercel environment variables.
- Deploy and test Firestore rules before enabling real withdrawals.
- The reseller withdrawal collection must NOT allow client-side creates once the secure API is active; otherwise a direct Firestore client could bypass atomic wallet reservation. The intended final rule is owner-read/admin-update only with client create denied.
- Verify the configured Firebase Admin UID before production deployment.
- Add a scheduled server invocation for matured reward release if automatic release is desired; the user wallet endpoint can also release matured rewards on demand.
- Test refund/cancellation reversal before paying real money.

## Money safety
No client code is trusted for reward percentages, wallet balances, order status, or payout status. All monetary mutations use Admin SDK transactions.
