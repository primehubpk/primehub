# Rs.100 PrimeHub V12 App Welcome Reward — Simplified Plan

This branch implements the owner's low-friction welcome-gift preference:
- No Play Integrity API, Google Cloud linking, user prompt, second account, OTP, or Google Sign-In.
- Same existing Firebase **email/password** session as reseller/Prime Family.
- In the signed Android V12 app, once a signed-in customer has an available Play-sourced install, the native code submits one claim. Display congratulations ONLY if the server transaction actually credits Rs.100.
- Existing users and new users are eligible; a missing reseller profile is created in the same atomic transaction using the authenticated Firebase UID/email.
- Once per UID **and per app-scoped Android device ID hash**. The raw Android ID is never stored. IMEI is never accessed.
- Rs.100 is **withdrawable cash** and also spendable at checkout. Rs.500 minimum withdrawal unchanged.
- An existing claim returns an 'alreadyClaimed' result. No new credit or misleading popup.
- Server kill switch: `PLAY_INSTALL_BONUS_ENABLED=true`; requires `PLAY_BONUS_DEVICE_HMAC_SECRET` (at least 32 chars).
- Flag remains OFF until release rollout. No live cash credit or production data mutations were performed during development.

## Honest limitations

This deliberately removes **cryptographic** Play attestation. Android's installer string and app-scoped ID are client assertions; a technically skilled attacker could modify/fake them, even if normal users cannot. One-account/device checks prevent ordinary repeats but do NOT prevent every fake claim or emulator attack. Keep the server kill switch accessible and monitor total credits.

Google Play policy restricts artificially incentivized installs and ratings. Treat this as a supplemental commerce-app welcome reward, not as an installation-count promotion or reward for reviews. Verify the Play policy/current store listing before advertising it.

No change to existing browser-scoped spin wheel and per-account daily check-in/streak protections. Those are separate features; web/laptop cannot read phone IMEI.

## Safest rollout sequence

1. Run code tests and signed Android build; verify exact current original upload certificate and versionCode 12.
2. Review live Firestore security rules / cash ledgers and verify promo sandbox transaction using a designated QA Firebase user.
3. Deploy backend/website to production with `PLAY_INSTALL_BONUS_ENABLED=false` (not yet authorized). Keep automatic production builds disabled until approval.
4. Upload this **updated** V12 AAB to the existing Play Store listing (not the earlier Integrity-based AAB), release to testers first, and test sign-in/first credit/second attempt/same device different account.
5. Only after successful signed Play installation, enable the flag and redeploy the environment. No Google Cloud Play Integrity setup required.
6. Verify Congratulations once, wallet +Rs.100 once, spendable cash and Rs.500 withdrawal rule; check repeated launch and sign-out/in.
7. Have a single 'off' switch available if the credit ledger detects abuse.

Never deploy to main or publish on Play Store without the owner's explicit confirmation.
