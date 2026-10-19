# PrimeHub Social AI — real installed TikTok UI test (personal Android APK)

The owner's request is **not** for OAuth/API-mediated posting: the app should open their already logged-in TikTok application and, with their explicit permission, interact with UI controls like a person. A social platform content-posting API is NOT inherently required for a local, supervised tap inside the real installed app.

## Technical distinctions

- **Android application launcher:** opens `com.zhiliaoapp.musically` and TikTok keeps its existing account session. Our app cannot read cookies/passwords or know TikTok's signed-in account merely from opening it.
- **On-device UI interaction:** Android's `AccessibilityService` can inspect a limited UI node hierarchy and request supported actions. It is a sensitive capability and must be manually enabled by the owner in Android Settings. It can be restricted, unavailable, or behave differently on Xiaomi/Android versions.
- **Remote ChatGPT control:** NOT included in this milestone. The personal MCP connection only checks device pairing and prepares approved handoffs. A separate authenticated, revocable, logged, time-bounded **supervised action protocol** is required to bridge ChatGPT requests to Android. Never expose a generic public API that can click arbitrary coordinates or read other apps' UIs without oversight.
- **Screenshots:** not part of this milestone. Live screen capture needs explicit Android MediaProjection consent (and/or supported Android accessibility screenshot capabilities) and extra privacy protections, including visible indicators and revocation.
- **Uploading videos:** local TikTok app may use Android media chooser/share intents; remote upload would require a secure owner-approved transfer of user-selected media, and owner confirmation for publish.
- **Multi-account:** account selection takes place **inside TikTok's UI**, not PrimeHub's cookies; opening real TikTok reuses its sessions. PrimeHub can save local labels but they are not proof that the account was selected.

## Implemented now: narrow, safe local proof

- **Native TikTok Control Test** activity with a clear disclosure.
- Optional Android Accessibility service scoped to TikTok's app package only, with `isAccessibilityTool=false` and no misleading accessibility-tool claim.
- Owner opens the real TikTok app already signed in, then can manually approve a **single** Create/Upload entry-button click with an 8-second timeout.
- Service never inspects EditText widgets, passwords, private messages or typed captions. Only tries to match an exact safe label such as `Create` or `Upload`.
- It does not interact with buttons labeled `Post`, `Publish`, `Next`, `Delete`, `Pay` or `Send`, cannot execute remote commands, and never transmits screen/node data.
- It records only the local result of the last authorized test.
- Does not touch the PrimeHubMall shopping website, its Google Play app, or the installed TikTok application's data.

## First private device test

1. Android app signed version 1.4.0 or newer is required **once** for the native Android service declaration. This CANNOT be delivered by Vercel website updates: Android must receive and install a signed APK update, and the user must accept it.
2. Install the owner-signed APK **over** the existing stable `com.primehub.socialai` (no uninstall, owner signing certificate unchanged).
3. Open **TikTok → Control Test**.
4. Tap **Open my real TikTok**. Check that TikTok uses its existing logged-in account.
5. Return to PrimeHub Social AI → TikTok Control Test → read permission disclosure → optionally enable service in Android Accessibility settings.
6. Tap **Test one safe Create/Upload tap**, approve, and TikTok opens. The service has 8 seconds to find an eligible entry button and click once. It never publishes.
7. Return to the Control Test screen and check local test status. Disable the service in Android Settings if desired.

Do not advertise this as automated posting or direct ChatGPT control until a secure command channel and physical phone tests pass.

## Google Play policy caveat

Google Play's AccessibilityService automation rules restrict autonomous AI agents that initiate, plan and execute actions. This build is a **personal sideloaded, owner-supervised prototype**, not a Play-approved unattended AI posting app. Publishing such a feature to Google Play would require policy review, accurate disclosure, and alignment with platform rules.

Official references:
- https://developer.android.com/guide/topics/ui/accessibility/service
- https://support.google.com/googleplay/android-developer/answer/10964491
