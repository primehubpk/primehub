# PrimeHub Social AI — Android in-app update system

This is the **owner's personal application**, not a public ChatGPT plugin submission. The existing PrimeHubMall shopping website and its Google Play package are independent and unchanged.

## What is implemented

- Native `Check app updates` screen inside the Android app (version code 3, version 1.2.0).
- A secure update feed: `GET https://primehub-social-ai-primehubmall.vercel.app/api/android-update`, backed by official GitHub release metadata. A missing signed release returns `versionCode:0` — **never a fake update**.
- The app downloads only an approved PrimeHub GitHub release APK, verifies SHA-256, exact Android package ID, increasing version code and the **same signing certificate as the installed application**, then opens Android's system installer for the owner's approval.
- The APK is served through a non-exported, read-only Android `ContentProvider`. The app never silently installs, removes the current app or accesses stored passwords or social app sessions.
- An isolated, **manual-only**, owner-signed GitHub workflow: `.github/workflows/primehub-social-owner-signed-release.yml`, which refuses to create a release without the owner's long-term signing credentials.

## Why old debug APKs cannot be remotely patched

The earlier GitHub Actions **debug builds were signed by ephemeral keys**. Examining the APK signing certificates supplied in this conversation confirmed the original test builds have **different certificate fingerprints**. Android intentionally refuses in-place updates signed with a different key. A publicly available MCP connection does not change Android's update verification or give the assistant permission to install packages on the owner's phone.

The old debug test app uses `com.primehub.socialai.debug`; the dedicated stable release package uses `com.primehub.socialai`. These can **coexist on one phone**, so you do **not** need to uninstall the old debug app. However, their local data and cookies are separate. Finish or export important tasks from the old app before switching. Android cannot carry the old debug app's private data automatically into the newly signed release.

**One-time setup:** install the first stable owner-signed `com.primehub.socialai` APK alongside the old test build. After that, use the stable app's **Check app updates** button for subsequent signed releases; no uninstall is needed. The Android installer still requires the user's confirmation.

## Owner signing — required before a production update can be published

The long-term signing key must stay private and backed up. It must **never** be committed to this public repository, printed in an Actions log, pasted in a ChatGPT message, or embedded in the Android app.

1. Generate and safely store an Android signing keystore in PKCS#12 format on your own trusted computer (ideally use the connected Desktop Commander *while online* for this step). Record its alias and store/key passwords in a password manager. Make a secure backup. **If the signing key is lost, Android in-place updates with that app ID can become impossible.**
2. In GitHub repository settings → Secrets and variables → Actions, set these **encrypted repository secrets**:
   - `PH_SOCIAL_KEYSTORE_B64` — base64 of the PKCS#12 keystore file.
   - `PH_SOCIAL_KEYSTORE_PASSWORD` — its password.
   - `PH_SOCIAL_KEY_ALIAS` — the signing key alias.
   - `PH_SOCIAL_KEY_PASSWORD` — signing key password.
3. From the GitHub Actions page, choose **PrimeHub Social AI Owner-Signed Release** and run it against a reviewed commit **with publish set to false**. Confirm the generated `PrimeHub-Social-AI-Owner-Signed-Release` artifact is correctly signed and installs **alongside** the existing debug test app.
4. On the next release, increment `versionCode` and test against the same key. The workflow can publish a `social-ai-vN` GitHub release with `primehub-social-ai.apk` asset **only after the owner explicitly approves publish=true**. Publishing a binary on this public GitHub repository makes the APK download publicly accessible, even though the ChatGPT plugin is private.

If you do not want even the APK download publicly accessible, **do not choose publish=true**. A separate authenticated release delivery channel must then be implemented. The app update feed does not yet support a private download relay.

## Check and update from the stable app

1. Open PrimeHub Social AI → **Check app updates**.
2. Tap **Check for updates**. If no stable signed release is published, the app will tell you so.
3. When an approved update exists, tap **Download and install verified update**.
4. The app verifies checksum, identity, version and certificate. Android will then ask for installation approval. It may ask you once to allow installation from PrimeHub Social AI in Android Settings.
5. After updating, open the same app. Android preserves its own application data when installer verifies the matching app ID/signing key.

## Still pending

- **Permanent signing secrets are NOT configured through the connected tools yet.** The signing key must be created and stored securely; the GitHub plugin currently has no secret-writing operation.
- **No stable signed APK has been published**, so the Android in-app update feed does not currently offer an install.
- **A physical phone update test** cannot be performed until the first stable build is installed.
- This system cannot remotely operate installed TikTok/Instagram/Google Maps. MCP pairing remains a distinct capability and does not authorize access to other apps.

Do not promise an immediate silent in-place upgrade of the prior debug builds, or tell the user to uninstall and lose existing sessions.
