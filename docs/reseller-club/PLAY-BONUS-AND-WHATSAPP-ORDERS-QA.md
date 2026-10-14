# PrimeHubMall — Play Bonus + WhatsApp Orders pre-release checklist

**Feature branch only:** `feature/reseller-wallet-admin-dupes-oct14`.
Do not merge, deploy to Vercel, change Cloudflare buckets, award production money or publish AAB until owner authorizes.

## Play Store Rs. 100 bonus

- SAME Google Play app listing / package `com.primehubmall.app`: update existing signed Android app v12; **not a new app/listing**.
- Sign-in/sign-up **remains existing Firebase email + password**; no Google OAuth buttons/providers added.
- The site global client checks only inside native Android app v12, after existing Firebase session resolves. New member triggers another check when their reseller profile is ready.
- Popup/banner with **Congratulations, You got Rs. 100!**, close X and View My Wallet appears ONLY when native Play Integrity validation + server-side atomic withdrawable Rs.100 credit succeeds.
- On device with already-paid claim, local state avoids further checks; server Firestore device/account claim records are authoritative.
- The popup *aims* for early display, but 2–3 seconds **cannot be guaranteed**. Google Play Integrity / slow mobile data may require longer. Never show congratulations before the real credited transaction.
- The bonus remains **off by default** (`PLAY_INSTALL_BONUS_ENABLED` must be explicitly `true`). Also needs server-only `PLAY_BONUS_DEVICE_HMAC_SECRET` (32+ characters), Google Play Integrity API enabled and correctly authorized service account, Play-recognized app signature, `LICENSED` verdict, verified device. Do not put server secrets in client/Gradle.
- Reward is put in `walletAvailable`, i.e. **withdrawable cash**. It also contributes to Total Cash for Shopping, but Rs.500 minimum withdrawal unchanged. Real device + Firebase test project required to test actual credit, duplicate claim, logout/login and refund interactions.
- Native v12 debug APK is just test build, not a Play Store upload.

## WhatsApp customer orders

- Website Checkout → WhatsApp, or WhatsAppOrderModal: server re-prices real products/variants then stores an **unconfirmed request** in `whatsapp_order_intents` using only one Firestore write. Metadata includes customer, phone, city/address/notes, images, variants, quantities, delivery and total.
- Opening `wa.me` DOES NOT establish that customer pressed Send. Intents are clearly labelled **WHATSAPP REQUEST · NOT YET CONFIRMED** in Admin → Orders → WhatsApp Requests; they must not count toward revenue, orders or reseller reward.
- Admin confirms only after checking actual incoming chat and matching the request reference. Then a **real order** is created in Supabase (Firebase fallback/mirror) and appears in All Orders; or admin dismisses draft.
- Customers who message the WhatsApp number **directly, without using the website**, are **NOT automatically visible**: the existing Meta WhatsApp webhook is not connected and does not parse messages. Until a secure Meta WhatsApp Business integration is connected, admin enters a real chat using Admin → Orders → Record WhatsApp Order (name, phone, city, address, item name, quantity, price, variant, image URL, delivery and notes).
- There is no periodic background fetching and no new home page image or product calls. WhatsApp requests are loaded only while Admin Orders is opened/refreshed.
- No WhatsApp draft should debit customer shopping wallet. To use wallet cash, customer must Place Order on the website (atomic deduction).
- Manual and approved WhatsApp orders must not reward reseller until admin explicitly approves reward and validates ownership. Repeat request IDs should never create duplicates.
- Manual external chat entries are admin verified, using signed wallet-admin session and same-origin POST.

## QA

1. Existing signed-in user in actual Play-installed native v12 → congratulations after Google verification + walletAvailable +100 exactly once. Relaunch/switch account/reinstall should not duplicate credit. Unverified or website Chrome sessions cannot receive this bonus. Test poor data without fake popup.
2. New reseller email/password sign-up or sign-in in app → wallet profile is ready → bonus result banner and wallet. Existing Google sign-in remains **unimplemented**.
3. Normal Place Order: Rs.300 shopping credit + Rs.100 withdrawable cash = Rs.400 spent first, remaining COD accurately calculated, with transactional ledger and refund identity preserved.
4. WhatsApp on checkout & order modal with price variants → draft appears under Admin Orders, not in revenue/orders. Click WA link but *don't send*: remains unconfirmed. Manually confirm real incoming message: appears once in real Orders.
5. Customer messages business WhatsApp without using site → manually enter from actual chat, including products and images; verify saved order total, notification and refund policy separately. Automatic outside-website capture requires future Meta webhook permissions + message signature verification.
6. Mobile layout: popup X, View Wallet, cart, product images and Salary chat are unchanged; no polling, no unexpected Supabase/Vercel egress.
