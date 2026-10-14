# Reseller wallet: two-purpose admin credits (branch QA)

Branch: `feature/reseller-wallet-admin-dupes-oct14`

## Deployment safety

- This branch must **not** be merged or deployed without explicit approval.
- Vercel project-level preview deployments are disabled and the ignore-build command skips Git-triggered builds. Branch `vercel.json` sets `git.deploymentEnabled=false`.
- Re-enable the build when the owner explicitly requests a manual production rollout.
- Set server-only `ADMIN_PASSWORD` in Vercel **before** any rollout and rotate the legacy password exposed by old git history. Admin login on this branch deliberately fails closed while the variable is missing. Keep the password out of NEXT_PUBLIC variables, repo and screenshots.
- No production wallet adjustments, database merges, account deletion, or order placement were performed during development.

## Reseller identity investigation

There are two actual reseller profile records with two distinct Firebase UIDs, not duplicate rendering of one row:
- `saniakanwal0012@gamil.com` (typo domain)
- `saniakanwal0012@gmail.com`

The admin Member cards now display email and UID so the accounts are distinguishable. The 260 points stay with their original UID. Only consolidate or delete on explicit instruction after ownership and reward histories are verified.

## Money storage rules

- Firestore `reseller_wallet_credits/{operationId}`: append-only admin credit audit; idempotency operation UUID.
- Firestore `reseller_shopping_wallets/{uid}`: authoritative, **server-only** shopping balance; user cannot withdraw.
- Firestore `reseller_profiles/{uid}.walletShopping`: denormalized balance mirrored to Supabase for reporting/display.
- Firestore `reseller_profiles/{uid}.walletAvailable`: withdrawable cash, minimum withdrawal still Rs.500.
- Firestore `reseller_wallet_spends/{orderId}`: paid order wallet debit. The order, debit and ledger are created together in one Firestore transaction.
- Firestore `reseller_wallet_refunds/{orderId}`: append-only cancellation refunds. Repeated refunds are idempotent.
- The standard non-wallet order flow remains Supabase-primary. Wallet-paid orders are committed first in Firestore and mirrored to Supabase; admin Orders also reads wallet-order Firestore backup when mirroring is delayed.
- Deleting wallet-paid orders requires cancel/refund first; shipped/delivered orders need manual review instead of auto-refund.
- Wallet credit can only be spent via Place Order website checkout; WhatsApp orders do not debit wallet.

## Required checks before the owner authorizes deployment

1. GitHub branch CI: TypeScript and Next build must pass. Legacy home sale regression tests currently have pre-existing failures unrelated to wallet.
2. Set `ADMIN_PASSWORD` in target Vercel environment (do not expose its value). Sign out/in: new signed 4h wallet-admin session is issued.
3. Confirm an active reseller UID matches the intended email. Choose **Shopping only** and credit Rs.100 in a *test Firebase project or consented test account*. Refresh: admin wallet and reseller wallet should both show Rs.100; withdrawable remains Rs.0.
4. Test total Rs.75 with Shopping Wallet checked: paid Rs.75, amount due 0, remaining shopping Rs.25, ledger+order exactly once. Repeat request with same UUID; no second deduction.
5. Test order total Rs.175 using Shopping Wallet Rs.100: due Rs.75 and admin/WhatsApp show correct remaining COD.
6. Cancel a wallet-paid order once: refund same amount. Repeat cancellation: no duplicate refund. Refuse direct delete until refund.
7. Credit Rs.300 to **Withdrawable**: shopping balance unchanged. Cannot withdraw less than Rs.500. Credit enough to get at least Rs.500 and test existing withdrawal approval/rejection lifecycle.
8. Verify that normal guest and signed-in non-wallet checkout still works; Free Delivery/discounts unchanged; refund ledger records exist.
9. Confirm UI on mobile, exact admin and member identity labels, network retry, signup/resume and auth refresh.
10. Check Firestore rules deployment and production Vercel settings only as part of the **approved** rollout.

Do not interpret passing static CI as proof that real transaction flows were tested against production.

## October 14 follow-up — member controls, history, Salar contact toggles

- Member cards offer History, Block/Unblock, and Delete. No production account has been blocked or deleted.
- Block disables Firebase Auth, revokes refresh tokens, and suspends the reseller profile. Unblock reenables it. Both write a UID-scoped admin history event.
- Delete requires exact typed UID confirmation, a reason, zero withdrawable/pending/shopping money, zero verified task/loyalty points, and no pending claims/withdrawals/rewards. It removes Firebase Auth login but retains historical ledgers and deleted account audit identity. Deleted accounts are hidden by default; Show deleted accounts restores history access. Do not delete the 260-point member.
- History opens a per-member read including real `user_rewards.history` daily check-ins / spins, points ledger, tasks, orders, withdrawals, admin credit/spend/refund and account actions. No fabricated award values are shown.
- Read-only production data verification for UID ending `AOi0p1`: user_rewards.points = **260**, task point ledger = **0** events/points, user_rewards.history = **7** events (four Day 1 check-ins and three Try Again spins). Older entries lack exact `pointsAwarded`; therefore the exact historical composition of the 260 points cannot be reconstructed honestly. New reward-action entries save explicit `pointsAwarded`.
- Admin > Salar: two WhatsApp number fields and separate ON/OFF switches. Changes persist in Supabase `settings/salar_ui`. Salar public status sends only enabled numbers; opening widget renders links from saved settings. Changes invalidate settings cache.
- Before rollout, verify fresh admin login with newly configured **ADMIN_PASSWORD**, an inactive blocked reseller cannot log in, unblocked member can sign in, no funds or points are lost, Delete of a financial account is rejected, and the intended test account is the only identity affected.
- Test Salar: number A OFF means only B visible; both OFF means no contact tiles; edit number B and verify WhatsApp URL matches new E.164 number. Icon and Salar instructions must remain unchanged.
- GitHub Actions TypeScript/build checks verify compilation but cannot prove production Firebase Auth/Firestore transaction paths or mobile UI. Do not claim live financial integration tested unless explicitly run in an isolated emulator/test project.
