# PrimeHub Social AI — Shizuku setup + read-only virtual-display readiness (v1.6)

The owner's **Redmi Note 14 (HyperOS)** screenshot on 19 October 2026 shows:
- **Shizuku is running — Version 13.5, adb**.
- Previous OEM ADB restriction warning no longer shown.
- **Authorized 0 applications**, meaning PrimeHub Social AI was not integrated/authorized yet.

**What this change does:** Adds official **MIT-licensed** Shizuku SDK v13.1.5 to PrimeHub Social AI, a protected ShizukuProvider, and an in-app **Virtual Workspace** screen. The owner can explicitly grant Shizuku permission to PrimeHub Social AI and run one fixed-function read-only check. It uses a non-daemon Shizuku UserService with explicit AIDL method IDs and no arbitrary shell-command remote execution. The phone can reveal an ADB UID 2000 Shizuku UserService plus secondary-display feature advertisement and built-in display command capability.

**What it does NOT do:** It does **not** create virtual displays, launch TikTok off the user's main phone screen, copy credentials, bypass other-app security or make ChatGPT control a second display. Shizuku authorization grants shell-level capabilities; it must not be given to untrusted applications. This initial read-only integration is a compatibility/security check before creating and launching a real separate virtual display safely. Future behavior must explicitly fail without touching the owner's real main display. The user's goal remains direct ChatGPT control of a private, independently operating virtual display on the SAME handset without needing a second device or laptop, not any extra AI model.

User flow:
1. Owner keeps Shizuku 13.5 running (already proven in screenshot). No new changes to Android settings are needed right now.
2. Owner installs the **owner-signed** v1.6 APK **over** installed v1.5 (same signing certificate; Android consent required). **Do not uninstall** or erase app storage.
3. PrimeHub Social AI → **Virtual Workspace · Shizuku connection** → **Allow PrimeHub Social AI in Shizuku**.
4. Confirm the full Shizuku permission dialog only for the trusted own app. Then tap **Check Shizuku & display compatibility**.
5. Share a screenshot of only the local read-only display diagnostics and permission status; no Shizuku pairing code, IP or secrets.
6. If Android secondary-display capability is missing or UserService cannot get UID 2000, stop and investigate. Do not promise virtual-screen creation.
7. Future stage: implement a single temporary, screen-isolated display with controlled target launch of PrimeHub-owned test activity and strict cleanup, only if ROM permits. Follow with real TikTok compatibility tests. Screenshots, network sessions, posting/DMs, background reliability and owner action approval remain separate tasks.

Owner private PKCS12 signing lives only in encrypted GitHub Actions secrets. Do not display / check in secrets.
CI signed APK, package identity and certificate verification are required. Feature branch only; do not merge website main or affect shopping Play Store app.
Official refs: https://github.com/RikkaApps/Shizuku-API/blob/master/README.md and https://central.sonatype.com/artifact/dev.rikka.shizuku/api/13.1.5 .
