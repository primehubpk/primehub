# PrimeHub Reseller Club — Phase 8 Admin Control

## Admin sections
- Reseller overview and member status
- Tier configuration
- Reward rules
- Wallet overview
- Withdrawal queue
- Monthly challenge configuration
- Social task configuration

## Settings that should be editable
- Reseller Club enabled/disabled
- Tier order thresholds and percentages
- Minimum withdrawal amount
- Challenge target, reward type, cash amount or gift details
- Task enabled state, title, destination URL, points and verification method

## Security boundary
Admin controls must use the existing Firebase admin authorization pattern. A normal customer/reseller must never be able to write reseller settings, wallet balances, tier rules or withdrawal status.

Real admin writes are intentionally not enabled in this UI-only phase. They will be wired only after the Firestore schema/rules are reviewed against the existing production rules.
