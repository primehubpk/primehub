# PrimeHub Reseller Club — Phase 5 Reward Rules

## Reward eligibility
Only an eligible reseller order with status `delivered` can generate a reward. Pending, confirmed, cancelled and refunded orders do not create an available reward.

## Tier used
The tier is calculated using the reseller's eligible monthly order count including the current eligible order. Default tiers:

- Starter: 5 orders → 5%
- Prime: 10 orders → 10%
- Pro: 20 orders → 15%
- Elite: 30 orders → 20%

## Reward lifecycle
A reward is recorded in a ledger as `pending`. It becomes `available` only after the configured post-delivery/return-review condition is satisfied. If an eligible order is later refunded or otherwise reversed, the reward must be reversed through trusted server/admin logic.

## Anti-abuse rules
- Never trust a reward percentage sent by the browser.
- Never trust a wallet balance sent by the browser.
- Never let the browser directly mark an order as delivered.
- Never create a second reward for the same order ID.
- Never make a pending/cancelled/refunded order withdrawable.
- Reward ledger entries should be immutable from the client.

## Phase boundary
Phase 5 creates the calculation and ledger contract only. Real Firestore writes, server-side order integration, and security rules are intentionally reserved for the secure implementation phase so existing checkout/order behavior is not changed prematurely.
