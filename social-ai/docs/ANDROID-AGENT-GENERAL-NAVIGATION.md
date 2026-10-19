# PrimeHub Social AI — reusable owner-only Android navigation agent (v1.5.0)

## The difference from the old hard-coded TikTok click test

This branch introduces a single **generalized agent loop** instead of implementing one Kotlin/Java button handler per TikTok page. After the owner starts a **15-minute session**, the Android Accessibility Service can report a bounded, sanitized list of the current TikTok screen's **clickable labels** to the personal MCP connector. ChatGPT can use this current screen state to choose its next low-risk navigation action (tap exact visible label, scroll up/down one page, Android Back) without developers adding each button to a static script. Commands are rejected if the phone is offline, the UI revision has changed, a previous command is pending, the owner session expired, or the label is restricted.

This is a **foundation for a general agent**, not full autonomy or media/social account management.

## Implemented

- Pairing with existing private owner device credentials; the owner must explicitly activate a separate **temporary 26-character session code**, maximum 15 minutes by default, and may revoke at any time.
- Tick/poll only while TikTok's original installed app is **foreground** and the owner's temporary session is active; TikTok retains its own login state.
- Read-only narrow **Accessibility node labels** for visible clickable elements only. No screenshots, OCR, video frames, sound, private message bodies, usernames, text-input values, passwords, cookies, social tokens or files. No change to users' original TikTok app data.
- Submit snapshots to a protected HTTPS endpoint using Android device pairing credentials in app-private preferences; the public JSON-RPC plugin cannot access or list devices without a fresh session capability code.
- Supabase table isolation + RLS; read/write only through validated owner-specific database RPC functions; expiry, one queued action, confirmation receipt, timeouts and stale-screen revisions.
- New personal MCP tools: `inspect_owner_android_screen` and `navigate_owner_android`. They require explicit owner code. Tool list refresh may be needed in ChatGPT custom Plugin settings.
- Device executes permitted low-risk navigation in its own AccessibilityService with a second local policy check. **Post/publish, messaging, purchases, deletions, likes, follows, payments, caption entry and account-switching are NOT supported** in this phase.
- Fixed TikTok feed up/down one-page swipe for interfaces that do not expose a scrollable tree, instead of hard-coded per-button TikTok flows.
- Screen revision changes only when the visible sanitized node list changes. Expired sessions cannot be used again; no replayable arbitrary shell commands.
- Native Android permanent owner-signing certificate stays unchanged, package `com.primehub.socialai`, versionCode 6 / v1.5.0. **Can install over existing v1.4.0 without uninstalling**, with Android's approval. This capability cannot be hot-inserted into an old installed Android binary by deploying a Vercel website.
- Vercel Social AI dedicated project only. **No merge to PrimeHubMall shopping main** and no public Plugin Directory submission.

## Deliberately NOT claimed

- Viewing real TikTok videos or hearing sounds. This requires Android screen/audio capture consent and a secure media pipeline; Accessibility labels alone cannot provide video/audio understanding.
- Identifying trends, producing and publishing TikTok videos autonomously.
- Reading/accepting message requests, replying to private messages, moderation or analytics metrics.
- Silent or automatic app upgrades, or remote control while the TikTok app is not foreground.
- One-click final posting; any destructive/external publish action requires owner approval and platform-specific testing. Google Play restricts autonomous AI agent use of AccessibilityService.

## Owner test (necessary physical-device check)

1. Install **owner-signed v1.5.0** over stable v1.4.0. Keep app data; no uninstall.
2. Check Android Settings → Accessibility for the PrimeHub Social AI service; if changed capabilities require re-approval, review and enable it. The owner can always disable.
3. PrimeHub Social AI → TikTok Control Test → **Start AI navigation session**. Read the warning, approve one time-limited session.
4. Copy the new temporary code in your **private** ChatGPT conversation (do not include it in screenshots).
5. Open the real installed TikTok app and keep it in the foreground during the test. TikTok's own logged-in session remains intact.
6. ChatGPT should refresh the custom PrimeHub Social AI plugin tool list if the two new MCP tools are not exposed, then call `inspect_owner_android_screen` with the fresh code to see sanitized clickable labels and live revision.
7. Call `navigate_owner_android` to request ONE low-risk action chosen from that current screen. Call inspect again to check the reported result. If the phone has navigated away, the session has expired, or the screen moved, the call should fail safely.
8. Return to PrimeHub Social AI → Stop session. Confirm previously issued code no longer works.

The user can chat from a separate computer while TikTok is open on their phone; for same-phone chat, switching to ChatGPT puts TikTok in the background. A full autonomous background workflow therefore still needs a separate long-running orchestration/notification UX and explicit media permissions. Do not pretend Accessibility alone is Chrome's CDP or a complete remote desktop.

## Risk/cost

- One phone at ~3-second low-risk polling while the 15-min session and TikTok are active: several hundred lightweight API requests. Not a background always-on agent. Session stops after owner expiry and does not access other apps.
- Personal plugin currently has **No authentication**; the new navigation tools are *separately authorized by a fresh secret code* and a server-side session. Before broader release, migrate the custom plugin to user-specific OAuth/device identity and review TikTok/Play policy.
- Never publish a screenshot of session/pairing codes. The previous long-term pairing code was visible in screenshots; a new **separate** code is generated for each time-limited navigation session.
