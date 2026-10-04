# Play Store technical checks used for v1.1.0

Checked against Google Play Help and Android docs on 4 Oct 2026.

| Requirement | Source | This build |
| --- | --- | --- |
| `minSdk` 24+ for Play automatic protection | [Automatic protection](https://support.google.com/googleplay/android-developer/answer/10183279) | `minSdk 24` |
| New apps must target Android 16 (API 36) from 31 Aug 2026 | [Target API level](https://support.google.com/googleplay/android-developer/answer/11926878) | `targetSdk 36`, `compileSdk 36` |
| Upload an Android App Bundle, not an APK | Play publishing rules | `app-release.aab` |
| Play App Signing + same upload key for updates | Play App Signing | existing `primehub-upload` key |
| 16 KB page size if the app ships native `.so` files | [16 KB pages](https://developer.android.com/guide/practices/page-sizes) | TWA has no native libs; Java/Kotlin default-compliant |
| 64-bit if the app ships native code | Play technical quality | no native code |
| Explicit `android:exported` on components with intent filters | Android 12+ | launcher `exported=true` |
| Package visibility for Chrome Custom Tabs | Android 11+ | `<queries>` for Custom Tabs + HTTPS |
| HTTPS only | Play security | `usesCleartextTraffic=false` |
| No advertising ID / media / location permissions | Data safety | INTERNET only |
| Version code must increase after a rejected upload | Play versioning | `versionCode 2` / `1.1.0` |

Store listing still needed in Play Console (not part of the AAB): privacy policy, account deletion URL, 2+ phone screenshots, content rating, Data safety form.
