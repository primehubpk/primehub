# PrimeHub Reseller Club — Phase 7

## Monthly challenge
Default example: complete 10 eligible orders in one calendar month and unlock Rs. 1,000 bonus cash. Admin may later switch the reward to a PrimeHub gift.

Challenge settings should eventually control:
- enabled/disabled
- title and description
- target order count
- reward type: cash or gift
- cash amount
- gift title/details
- month/period

## Social tasks
Default tasks:
- YouTube: +50 points
- Instagram: +50 points
- TikTok: +50 points
- Share PrimeHub: +100 points

Each task should be admin-controlled for enabled state, points, title, description, destination URL and verification method.

## Important anti-abuse rule
A task must not award points merely because a browser button was clicked. Verification must be explicit (for example manual/admin verification or an approved server-side mechanism). Challenge completion must use eligible order data, not a client-supplied order count.

## Phase boundary
Phase 7 provides the UI and configuration contract. Real points writes, monthly reset/period logic, challenge reward issuance and verification will be connected through trusted backend/admin logic in the later secure integration phase.
