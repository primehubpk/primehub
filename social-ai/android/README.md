# PrimeHub Social AI — Native Android App (Test Build)

**Separate install package:** `com.primehub.socialai.debug`. This does **not** replace the existing PrimeHubMall shopping app.

## Ready in the Android test build

- Native launcher for PrimeHub Social AI, Facebook, Instagram, TikTok Studio, YouTube Studio, WhatsApp Web, Google Business, Canva, CapCut, Metricool, Windsor.ai and other official websites.
- Add or remove any trusted HTTPS website shortcut. Custom sites are stored in the Android app's private SharedPreferences.
- In-app browser (Android WebView) with JavaScript, DOM storage and persistent first-party cookies. Sign in on each platform's actual website, **not in a PrimeHub password form**.
- File picker for selecting images/videos to upload when the website allows.
- Native back/home buttons, reload and **Open Chrome** fallback.
- Security boundaries: SSL errors denied, no insecure HTTP links in WebView, no JavaScript bridges, no password/session export, no mixed-content and no third-party cookies. Deny camera, mic and location requests.

**Important limitations:** This is a real Android website browser, not the native Facebook/Instagram/TikTok apps. Some services (especially Google and social login providers) block sign-in using embedded WebViews. Use the app's Open Chrome fallback when needed. Chrome sessions are different from WebView sessions.

It is **not** an autonomous bot, does **not** automatically publish, does **not** expose the device to ChatGPT, and does not supply a cloud browser that keeps running when the phone is off. Those features require separate authenticated owner-approved integrations. A public MCP server cannot safely receive cookies, passwords, or unrestricted controls.

## Install testing APK

1. Go to GitHub Actions → `PrimeHub Social AI Native Android APK` → most recent successful run.
2. Download its `PrimeHub-Social-AI-Native-Android-APK` artifact ZIP.
3. Extract `app-debug.apk` and install it on Android (allow unknown-app installs for your file manager if prompted).
4. Open PrimeHub Social AI. Tap a platform to use the website, or + Add your own HTTPS URL.
5. Log in on the actual website; expect reauthentication if platform sessions expire.

This APK is **debug-signed**, suitable for owner testing only. No Play Store publishing or shopping-app AAB changes were made.

## Build command
```bash
bash play-store/android-twa/gradlew -p social-ai/android :app:assembleDebug
```
Requires Java 21, Android SDK API 36. Existing repository Gradle wrapper is reused; code is isolated in `social-ai/android/`.

## Future work
- Test embedded logins and video uploads on physical Android device.
- Optional in-app website compatibility indicators and dedicated native UI.
- Implement a separate secure owner-only device companion or compliant remote publishing worker before allowing ChatGPT to interact with the app. Never expose user sessions via a public connector.
