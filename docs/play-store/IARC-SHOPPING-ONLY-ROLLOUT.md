# PrimeHubMall — IARC Shopping-only Transition QA

Goal: accurate 3+/12+ eligibility, without incorrect Play statements or losing customer balances.

## Feature branch implemented
- One-time signup credit goes to server-authoritative shopping wallet; no cash credit.
- New delivered order, inviter/referral, voucher and WhatsApp rewards use shopping-only credits.
- New withdrawal API refuses requests. Legacy requests can still be reviewed by admins.
- Existing available balances, previous orders and claims stay untouched.
- User-facing wallet/checkout/promo text no longer advertises new cash payouts.
- Admin cannot issue new withdrawable credits.
- New orders and reward ledger items are explicitly marked shopping only; prior items retain original obligations.

## Completed checks
- TypeScript success.
- Next.js optimized build success (local missing production env warnings).
- 23/23 targeted tests pass.
- Supabase current project nmhwwxhanvceznhbrhri ACTIVE_HEALTHY.
- Supabase mirror read only: 3 profiles, Rs 200 available, 1 historic Rs 500 withdrawal marked paid. Verify source of truth in Firestore.

## Required before live Play questionnaire change
1. Inspect authoritative Firestore balances, outstanding claims, stored vouchers and settings.
2. Resolve all pre-existing cash promises fairly, do not silently convert money previously promised.
3. Audit dynamic reward images, admin tasks, wheel gifts, gift cards and promotions for any cash-convertible prizes.
4. One Vercel preview on branch after checking Ignored Build Step; test all customer, cart, credit, signup and admin flows.
5. After owner approval merge and make one controlled production deploy; confirm TWA native Play application displays the same actual content.
6. Only after new live behavior genuinely includes no cash rewards or cash-convertible gifts, update Play IARC answer if accurate. Germany USK rating 18+ may remain an override and require rating appeal.
7. Check missing Play Install button separately on affected Android device/account for age restrictions, country and compatibility.

Never change main, customer records or IARC questionnaire merely to make the rating appear lower.
