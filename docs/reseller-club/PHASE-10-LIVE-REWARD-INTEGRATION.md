# PrimeHub Reseller Club — Phase 10 Live Reward Integration

## Completed in this phase
- Added a dedicated live Firestore profile read helper for the authenticated reseller.
- Confirmed the existing order model has a `delivered` status and reseller reward calculation can use delivered eligible orders.
- Confirmed withdrawal requests are isolated in `reseller_withdrawals` and admin-only for status changes.
- Kept wallet crediting out of browser code.

## Production-safe boundary
The repository currently has no trusted server-side reward worker/API in this branch that can safely mutate reseller wallet balances from delivered orders. Therefore Phase 10 does **not** fake live rewards by writing wallet values from the browser.

## Required trusted operation
A production reward worker/server route must:
1. authenticate/verify the order source;
2. confirm reseller ownership/eligibility;
3. confirm the order is delivered and outside the configured return/reversal window;
4. enforce one reward ledger entry per order ID;
5. calculate the tier/rate from trusted admin settings;
6. atomically create the ledger entry and increment wallet balance;
7. reverse the ledger/wallet impact if an eligible order is later refunded.

Withdrawal payout must similarly reserve funds atomically, prevent double-spend, and let only an authorized admin mark a request paid.

## Next implementation requirement
Before enabling real-money rewards, add a trusted server environment using Firebase Admin SDK (or an equivalent protected backend) with the necessary secrets stored outside the client bundle. Then connect delivered-order events to the reward ledger and wallet transactionally.
