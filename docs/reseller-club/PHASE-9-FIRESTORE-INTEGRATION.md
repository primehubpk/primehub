# PrimeHub Reseller Club — Phase 9 Firebase Integration

## Implemented
- Firebase Auth remains the identity source for reseller accounts.
- New reseller signup creates `reseller_profiles/{uid}` with safe zero balances and Starter tier.
- Existing Firebase users can sign in through the Reseller Club and are enrolled if they do not already have a reseller profile.
- Reseller dashboard reads the authenticated user's own profile from Firestore.
- Firestore rules allow owners to create/read their own reseller profile, while tier/wallet/status updates remain admin-only.
- Withdrawal requests have an owner-only create/read path and admin-only update/delete path.

## Existing-data safety
The existing products, categories, settings, orders, rewards and admin audit rules remain unchanged in behavior. The new reseller rules are additive before the catch-all deny rule.

## Real-money boundary
This phase does not automatically credit wallet balances from client code and does not enable client-side payout approval. Reward issuance, wallet mutation and payout completion must be trusted backend/admin operations.

## Admin identity
The existing admin UID check remains the authority for admin-only reseller operations. Before any production rules deployment, verify that the configured admin UID is the intended Firebase Authentication UID.
