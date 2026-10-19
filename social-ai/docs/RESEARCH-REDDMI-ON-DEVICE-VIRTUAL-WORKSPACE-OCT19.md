# PrimeHub Social AI — same-phone independent virtual workspace (research, 2026-10-19)

## Owner's exact acceptance criteria

- ONE existing Redmi Note 14 Pro / Android 15 / HyperOS; no second device, no always-on laptop, no cloud Android emulator subscriptions.
- Owner continues to use the main phone normally while ChatGPT, through the owner's private PrimeHub Social AI MCP connector, operates a **different active Android display** with TikTok/Facebook/Canva.
- Normal TikTok/native-app sessions; optional multi-account via Xiaomi **Dual apps** only after verifying per-ROM availability.
- No second AI model/agent deciding actions: ChatGPT reasons, PrimeHub native app acts as a secure, revocable screen/input transport.
- One-time device privileges, persistent owner-authorized connection with foreground-service indicator, task-level reviews for public posts, outbound messages, account changes, purchases.
- Reuse the existing permanent Android signing key and side-branch only; never replace PrimeHubMall shopping app/main.
- Avoid per-button Android releases. App/Android version updates only for native platform capability changes.

## Research results (not yet tested on owner's phone)

1. Android ordinary apps cannot generally launch arbitrary third-party activities onto an ordinary **private virtual display**. Android AOSP multi-display security and `ActivityOptions.setLaunchDisplayId` restrict activity starts. Merely calling `DisplayManager.createVirtualDisplay` in the current unprivileged Social AI APK is NOT a working solution.
   - https://source.android.google.cn/docs/core/display/multi_display/activity-launch
   - https://developer.android.com/reference/android/app/ActivityOptions
2. **Shizuku** starts a background process with ADB/shell privileges after owner enables Android **Wireless debugging** and pairs on the *same phone* (no PC, no root, Android 11+). Some privileged system APIs are then accessible to a separately approved app. Shizuku must be manually restarted after phone reboot; HyperOS may freeze background apps.
   - https://shizuku.rikka.app/guide/setup/
   - https://github.com/RikkaApps/Shizuku
   - https://github.com/RikkaApps/Shizuku-API (MIT SDK; no copying of logos/package identifiers)
3. Technical proof of concept: https://github.com/lejw0925/android-virtual-screen is a beta that explicitly implements same-phone **separate Android virtual screen**, target-app launching, screenshot, authenticated MCP and tapping with **Shizuku UID 2000**. Its authors report **19/19 MCP operations passed in an Android 15 emulator**. Their HyperOS physical testing is a different phone/model/Android version, not evidence the owner's Redmi passes. Screen-off and vendor background-kill behavior need testing.
   - https://github.com/lejw0925/android-virtual-screen/blob/main/README.en.md
   - https://github.com/lejw0925/android-virtual-screen/blob/main/docs/BACKEND_EMULATOR_VALIDATION.md
   - https://github.com/lejw0925/android-virtual-screen/blob/main/docs/TUNNEL_BACKGROUND_VALIDATION.md
4. IMPORTANT BUSINESS LICENSE: the beta Virtual Screen repository is **PolyForm Noncommercial 1.0.0**. PrimeHub business posting is a commercial purpose. **Do not copy/embed/deploy the beta or its source** without the author's explicit commercial permission. It can be examined as publicly available technical evidence. Design an **independent implementation** against official Android/Shizuku (MIT) public interfaces and properly licensed dependencies.
   - https://polyformproject.org/licenses/noncommercial/1.0.0
5. Xiaomi official FAQ confirms Redmi Note 14 Pro 5G supports **Dual apps**: Settings > Apps > Dual apps. Whether the user's exact model supports TikTok clone and whether it can launch on the virtual display is not yet checked.
   - https://www.mi.com/uk/support/faq/details/KA-523773/

## Recommended architecture (no second AI model or laptop)

ChatGPT with private PrimeHub Social AI MCP tools
  -> Existing secured HTTPS/Supabase relay (phone-initiated outbound polling; no public raw ADB port)
  -> PrimeHub Social AI Android *foreground service* with owner-visible notification, revocation and per-operation audit
  -> independently implemented Shizuku UserService running under approved ADB/shell UID
  -> isolated privileged virtual-display creation / app launch / display-scoped taps / scrolling
  -> sanitized UI accessibility-node tree and owner-consented screenshot snapshots when necessary
  -> ChatGPT decides each next action via MCP, phone executes bounded commands on virtual display only

No password/cookie extraction. TikTok's own authentication remains in TikTok. Do not expose Shizuku port or uncontrolled shell command APIs; do not automate security prompts. Screen/audio access, app support, account switching and notification reliability vary by ROM/app. Never assume background guarantees while Doze/HyperOS can suspend processes.

## Gate 0 — owner prerequisite (no new PrimeHub APK yet)

On Redmi, owner installs official Shizuku from https://shizuku.rikka.app/ and uses **Start via Wireless debugging**. Requires enabling Developer options and Wireless debugging and pairing Shizuku using an Android-local pairing code. Root NOT requested. Never share the wireless ADB code or Shizuku secret in ChatGPT. Reboot restarts are needed for Shizuku. Grant Shizuku permission *only* to a reviewed PrimeHub owner APK later.

Ask owner to report *only* Shizuku home screen showing `Shizuku is running`; a screenshot should conceal codes and IP addresses. Do not ask them to disable Android security globally or grant broad Shizuku rights to unknown apps.

## Gate 1 — build one signed owner diagnostic version, after Shizuku confirmed

Create a new branch off the existing stable v1.5.0 PrimeHub Social AI code. Use the Shizuku API SDK's MIT-licensed artifact and own Java/Kotlin:
- Show Shizuku server running/authorized state and actual caller UID without exposing privileged tokens.
- Read `FEATURE_ACTIVITIES_ON_SECONDARY_DISPLAYS`, Android OS/build and device characteristics.
- Attempt to create one **temporary 720x1280 separate display** under Shizuku UserService; verify a known safe PrimeHub-owned test activity is launched only on target display, not the user's main display.
- Capture only test app's UI and perform one dry-run tap on its own test button.
- Cleanly remove test display when stopping. If not supported, do NOT launch another app on the user's actual display as fallback.
- Add deterministic CI tests, secure lifecycle and Android foreground-service disclosure; native APK signed using same permanent owner key; no uninstall.

Do not test TikTok or personal accounts before private display/input isolation has been verified.

## Gate 2 — real native TikTok separate-screen proof

- From Shizuku UserService start TikTok with explicit display target, **only if Android allows** and TikTok runs without crashing/black display.
- Show limited app UI snapshot and test one user-approved harmless scroll. Verify main phone simultaneously remains usable.
- Any failure must be logged locally with non-sensitive error and not fall back to display 0.
- Test foreground, app switching, screen off, low-battery and reboots separately. Shizuku needs startup after reboot; cannot promise zero maintenance or always-on behavior.

## Gate 3 — Chrome-like business use

- Persistent **revocable** owner binding and audited queued jobs; no 15-min expiry as the only method of access, but idle timeout, explicit permissions, immediate stop, action confirmation for posting/messages.
- Real screenshot/media stream + secure transfer of Canva-exported MP4 into an explicitly owned folder; privacy redaction and owner consent for capture. Audio playback capture may be unavailable.
- Multiple accounts only through native TikTok switching or compatible Xiaomi Dual apps; shortcuts are not authenticated sessions.
- Direct ChatGPT decision making with the private MCP interface, not an on-device AI model.
- Task execution needs ChatGPT Work or a supported scheduled runner; a normal chat reply does not run forever in background. Never claim continuous action from an inactive chat.
- TikTok trends/videos, analytics, DMs, video creation, final posting must each be independently validated. Safe approval before external publication and customer messages; platform policies still apply.

## Kill criteria

Stop and report truthfully if: Shizuku not permitted by owner; exact HyperOS build forbids creating/launching third-party activities on separate display; battery saver repeatedly freezes the session; TikTok does not support virtual display; user won't grant required Android permissions; Shizuku privilege is revoked. Do NOT ask user to root/unlock bootloader or risk wiping data.

**STATUS:** researched viable rootless technique and an independent architecture. Not implemented or verified on user's Redmi. This document alone does NOT change the installed APK or grant access to TikTok in the background.
