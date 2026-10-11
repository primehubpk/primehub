# Play Store technical checks used for 9.0.0

Checked against Google Play Help and Android docs.

| Requirement | Source | This build |
| --- | --- | --- |
| `minSdk` 24+ for Play automatic protection | [Automatic protection](https://support.google.com/googleplay/android-developer/answer/10183279) | `minSdk 24` |
| Target Android 16 (API 36) | [Target API level](https://support.google.com/googleplay/android-developer/answer/11926878) | `targetSdk 36`, `compileSdk 36` |
| Upload an Android App Bundle, not an APK | Play publishing rules | `app-release.aab` |
| Play App Signing + same upload key for updates | Play App Signing | existing `primehub-upload` key |
| 16 KB page size if the app ships native `.so` files | [16 KB pages](https://developer.android.com/guide/practices/page-sizes) | no native libs |
| 64-bit if the app ships native code | Play technical quality | no native code |
| Explicit `android:exported` on components with intent filters | Android 12+ | launcher `exported=true` |
| HTTPS only | Play security | `usesCleartextTraffic=false` |
| No advertising ID / media / location permissions | Data safety | `INTERNET` + `ACCESS_NETWORK_STATE` |
| Version code must increase | 8 is already on production | `versionCode 9` / `9.0.0` |
| Phone launcher matches Play listing | User report: phone showed a flat P | shopping-bag P mipmaps + round icon |
| App stays open after install | User report: TWA trampoline closed | `MainActivity` WebView |

Store listing still needed in Play Console (not part of the AAB): privacy policy, account deletion URL, 2+ phone screenshots, content rating, Data safety form.

Regenerate launcher art from the live Play listing icon:

```bash
python3 play-store/android-twa/scripts/generate_store_icons.py
```
