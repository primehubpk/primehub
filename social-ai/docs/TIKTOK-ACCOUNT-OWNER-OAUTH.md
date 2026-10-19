# PrimeHub Social AI — private TikTok account connection (owner only)

## Goal

Tap **TikTok → Connect** in PrimeHub Social AI instead of launching the installed TikTok app. The Android app shows **Connect TikTok account**, **Check account**, **Disconnect** and a separate, optional **Open original TikTok** action. The Android UI never asks for TikTok passwords. Owner login, account selection and consent occur in the **official TikTok Login Kit** page inside trusted Chrome, and the OAuth callback verifies the user's real profile using TikTok's `user.info.basic` scope.

After verified login, the app can show TikTok's display name and verification date; the **personal ChatGPT MCP tool** `check_owner_tiktok_account` can read the display name only after the owner supplies their private paired-device code. No raw account token, TikTok cookie, password, direct social-platform interaction, or automatic posting is exposed.

This is NOT yet a posting integration. TikTok's approved `video.publish` or `video.upload` scopes and a separate owner-confirmed Content Posting API workflow are required before the assistant could post via API. TikTok may restrict unaudited clients to private visibility.

## Required setup, before login can actually succeed

As of this implementation, **TikTok Login Kit developer credentials are not present** in the dedicated Social AI Vercel project. Do NOT fabricate a login-success screen or claim the account is visible in ChatGPT.

1. Owner opens [TikTok for Developers](https://developers.tiktok.com/), signs in, registers an app for PrimeHub Social AI, adds **Login Kit (Web)** and enables/requests the `user.info.basic` scope.
2. In TikTok Login Kit web setup, register **EXACT redirect URI**:
   `https://primehub-social-ai-primehubmall.vercel.app/api/tiktok-callback`.
   TikTok requires an exact HTTPS URI, without URL query parameters.
3. After TikTok enables the app/client key and secret, add Vercel project environment variables `PH_SOCIAL_TIKTOK_CLIENT_KEY` and `PH_SOCIAL_TIKTOK_CLIENT_SECRET` as encrypted values to the **separate** PrimeHub Social AI project only. Never paste the client secret into ChatGPT or commit it to public GitHub.
4. The server already has encrypted `PH_SOCIAL_TIKTOK_STATE_KEY` and `PH_SOCIAL_TIKTOK_SERVER_PROOF` and the isolated Supabase proof hash, **not** TikTok provider credentials.
5. Deploy this feature branch to the separate Social AI Vercel project; test `GET /api/tiktok-account` shows `loginKitReady:true` only after adding TikTok credentials; check that old original app is unaffected.
6. Install the **permanently owner-signed** Social AI v1.3.0 or later over the existing stable Social AI v1.2.0. Android validates `com.primehub.socialai` + SAME owner signing cert, so no uninstall or local data wipe. This app should be installed ONLY using verified signed APKs from the owner release workflow.
7. Android → TikTok → **Connect** → trusted TikTok login → consent → **Return to PrimeHub Social AI**. The app then checks stored verified display name. Once connected, verify in personal ChatGPT with `check_owner_tiktok_account`.
8. Rotate the pairing code if it has been shared publicly (screenshots count), especially after completing this integration.

## Security/limits

- OAuth state is an AES-256-GCM authenticated 10-minute payload containing the paired Android device credentials; it is opaque and bound to the specific device.
- TikTok's access token is exchanged only server-side and used only to fetch the verified basic profile. **No TikTok access/refresh tokens are persisted in this identity-only milestone**; future authorized posting will require a separate OAuth/token-retention design and TikTok permissions.
- The TikTok profile table is isolated from PrimeHubMall shopping data and denies direct access under RLS; access is via restricted security-definer RPCs. The callback has an extra server-only proof; JavaScript clients cannot fake a verified identity by writing the database directly.
- App credentials are not stored in the Android binary, GitHub, user screenshots or ChatGPT.
- The browser might reuse an existing TikTok web login and ask only for permission rather than your password. Account selection is controlled by TikTok, not by PrimeHub.
- Native TikTok launch remains available as a separate button but it cannot grant ChatGPT access to that app's UI or account cookies.
- Personal plugin is **NOT** submitted publicly, and no changes to PrimeHubMall shopping site, Google Play app, original Android phone's TikTok app or unrelated stores.

Official reference: https://developers.tiktok.com/docs/en/login-kit-web
