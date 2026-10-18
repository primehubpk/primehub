# Stable in-app Android updates — PrimeHub Social AI

## State
The feature branch contains an owner-initiated updater with a pinned release channel, SHA-256 verification, package-name and higher-version checks, signing-certificate comparison, and Android OS install confirmation. It does **not** silently install anything or take remote control of the phone.

**There is no stable signed APK published yet.** The update screen must display "No permanently signed update has been published yet" until a legitimate release exists.

## Why older test builds cannot update without reinstalling
We verified the actual APK signing certificates. All earlier uploaded test APKs (v1, v2, v3, v4, v1.1) have **different Android Debug certificates** because GitHub-hosted runners generated fresh debug keys. An Android device **will refuse an in-place APK update** with a different certificate. Neither ChatGPT nor an MCP connection can bypass this. Uninstalling the old test APK would delete its private saved tasks and WebView state; back up any important content first.

## Stable private owner signing (ONE-TIME setup)
Set up a permanent keystore in a secure location **you control**, ideally using Google's Play App Signing with an internal test track if the app is to be Play-managed. For direct private APK updates, configure GitHub encrypted secrets under the repository's **Settings → Secrets and variables → Actions**:
- `SOCIAL_AI_KEYSTORE_B64` — base64-encoded bytes of a newly generated owner signing JKS keystore, **not a password or public certificate**.
- `SOCIAL_AI_KEYSTORE_PASSWORD` — keystore password.
- `SOCIAL_AI_KEY_ALIAS` — key alias.
- `SOCIAL_AI_KEY_PASSWORD` — key password.

For the signed release workflow also configure the GitHub Actions **environment `social-ai-signing`** with owner protection. This workflow refuses to release an unsigned, ephemeral-debug-signed, or secretless APK. Do not commit keystores or passwords in this public repository. Back up the signing keystore securely. Losing it can force another destructive uninstall.

Use `keytool -genkeypair -v -keystore owner-social-ai.jks -alias socialowner -keyalg RSA -keysize 3072 -validity 10000` to generate a signing keystore locally (never send it or its password through chat). Use your local machine to base64-encode its bytes when populating encrypted GitHub secrets, e.g. `base64 -w0 owner-social-ai.jks` on Linux. On Windows, use local PowerShell to convert file bytes, then paste directly into encrypted secret form. NEVER post base64 keystore contents or passwords in a chat.

## Publish future versions
1. Developer edits the **separate** `social-ai/android/` source and increments `versionCode` monotonically (3→4→5 etc.).
2. Run GitHub Actions **PrimeHub Social AI Native Android APK** for syntax/build QA. That disposable debug artifact is NOT for installation over the stable signed build.
3. Once the owner approves the release and secrets are set, run **PrimeHub Social AI — Stable Signed Android Update** using the approved branch; type `RELEASE`.
4. The official `social-ai-vN` public GitHub release contains `primehub-social-ai.apk`, signed with the same permanent keystore.
5. On phone open PrimeHub Social AI → **Check app updates**. The app checks `https://primehub-social-ai-primehubmall.vercel.app/api/android-update` which selects the latest `social-ai-vN` tag and reads GitHub's SHA256 digest.
6. Tap **Download and install verified update**, approve Android's unknown-sources permission if prompted and then confirm the system installer. App data persists on valid in-place updates with the same package/signing key.

**Important:** Installing a new APK (even with paired MCP) cannot happen invisibly. Android requires a user action for self-update unless the device has special enterprise device-owner privileges. An MCP plugin does not grant those privileges, and this app does not attempt to bypass OS security.

The `REQUEST_INSTALL_PACKAGES` permission is used only to launch the normal Android package installer. If publishing through Google Play later, reconsider that permission and prefer Play's managed in-app updates.

## Backend API
`social-ai/api/android-update.js` calls GitHub Releases (public metadata), filters tags matching `social-ai-v[versionCode]`, and requires an official asset SHA256 and exact APK asset name. It does not expose user data or signing keys.
