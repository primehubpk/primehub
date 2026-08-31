# PrimeHub Reseller Club — Phase 4

## Scope
Phase 4 introduces the reseller profile/dashboard foundation and tier calculation helpers.

## Firestore design (implementation contract)
Collection: `reseller_profiles/{uid}`

Fields:
- `userId`: Firebase Auth UID
- `email`: account email
- `displayName`: optional display name
- `status`: `active | suspended`
- `tierId`: `starter | prime | pro | elite`
- `monthlyOrders`: current eligible monthly order count
- `walletAvailable`: available reward balance
- `walletPending`: pending reward balance
- `createdAt`, `updatedAt`: server timestamps

The profile must be owned by the authenticated UID. Client code must never be trusted to award money or change tier/wallet values.

## Default tiers
- Starter: 5 monthly orders, 5% reward
- Prime: 10 monthly orders, 10% reward
- Pro: 20 monthly orders, 15% reward
- Elite: 30 monthly orders, 20% reward

These are defaults for the UI/business model. Phase 8 will move tier values to admin-controlled settings and enforce them server-side.

## Reward lifecycle
`pending -> available -> withdrawal request -> admin review -> paid/rejected`

Phase 4 does **not** create or credit real wallet money. It only establishes the data contract and dashboard preview.
