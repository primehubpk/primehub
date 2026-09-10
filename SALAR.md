# Salar — Admin Testing Guide

Salar is implemented inside the existing PrimeHub website as ONE Salar talker + ONE Worker. The `feature/salar` branch is for admin testing only. Public visibility is hard-locked OFF in this branch.

## Environment variable names

Server-only unless explicitly marked otherwise. Never commit real values.

### Salar AI providers
- `GROQ_API_KEYS` — comma-separated Groq keys, tried in configured order.
- `GROQ_MODEL`
- `GEMINI_API_KEYS` — comma-separated Gemini keys, used after Groq is unavailable.
- `GEMINI_MODEL`
- `OPENROUTER_API_KEYS` — optional fallback.
- `OPENROUTER_MODEL`

### Salar order / media dependencies
- `WHATSAPP_BUSINESS_NUMBER` — optional. If absent, Salar uses the existing PrimeHub site WhatsApp setting.
- `R2_ACCOUNT_ID`
- `R2_BUCKET_NAME`
- `R2_PUBLIC_BASE_URL`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

### Existing PrimeHub backend/runtime dependencies
- `FIREBASE_SERVICE_ACCOUNT_KEY`
- `FIREBASE_ADMIN_UID`
- `ADMIN_PASSWORD`
- `PRIMEHUB_DATA_READ_MODE`
- `PRIMEHUB_BACKEND_WRITE_MODE`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Do not put provider keys, R2 secrets, Firebase service credentials, admin credentials, or Supabase service-role credentials in `NEXT_PUBLIC_*` variables.

## Provider rotation / quota safety

Text completion order is Groq keys → Gemini keys → optional OpenRouter. Rotatable auth/quota/rate/billing failures skip to the next key/provider. The last successful provider/key index is remembered in server memory for reuse. Raw key values are never intentionally returned to clients or written to Salar logs. Customer-facing failures use the safe PrimeHub fallback and phone `03238878009`.

## Catalogue safety

- Catalogue/knowledge requests check the Salar cache before loading index collections.
- Cache entries expire after 15 minutes.
- Catalogue Refresh replaces the index and clears Salar cache.
- Index metadata older than 24 hours, missing metadata, or an empty index returns an internal refresh-needed result.
- Customers do not receive an empty-index/debug dump; they receive the PrimeHub contact fallback `03238878009`.
- Salar sends only bounded Worker results to the language model, never the whole product index.

## Moderation

Worker job `moderate` runs locally before provider chat handling, so it does not consume LLM quota. It flags abuse, obvious spam, sexual content involving minors, actionable attacks, and actionable illegal instructions. Flag metadata is stored on the conversation for admin review. Salar remains polite and does not auto-block; admins can use the existing block/unblock controls. High-risk/actionable illegal requests are refused rather than taught.

## Chat, auth, limits and blocking

- Visitor conversation identity is derived server-side from an HttpOnly `salar_sid` cookie; visitor message/order APIs do not accept an arbitrary conversation ID for reading another chat.
- Firebase customer UID is optional and server-verified when supplied.
- Salar admin routes use the existing PrimeHub admin session boundary.
- Blocked conversations return `403` and expose the unblock contact `primehubpk1@gmail.com`.
- Message text is capped at 2,000 characters.
- Message rate limit: 30 requests / minute / Salar conversation.
- Image upload rate limit: 10 uploads / minute / Salar conversation.
- Images: JPEG/PNG/WebP only, maximum 4 MB before server compression/storage.

## Phase 7 order close regression

Admin testing should verify: real product → Rs 300 advance instruction → screenshot saved as `pending_verify` → name → city → phone → complete address → website-derived delivery/total → `order_summary` → real website `orders` row already exists → Place Order → WhatsApp. Same conversation + same selected items must remain idempotent.

## Admin test steps

1. Keep `salar_public_enabled` false. Open PrimeHub Admin and confirm Salar says **Admin testing only**.
2. From the homepage while admin is logged in, open Salar and test launcher, minimize, maximize, close, hamburger/admin drawer, quick-area dropdown, image upload, product cards and Place Order on desktop and a narrow mobile viewport.
3. Run **Catalogue Refresh**, then search a broad category, choose a collection and open products. Confirm a second identical request is cache-backed and no full index is shown in chat/prompt output.
4. Test provider ping with valid server env configuration. Confirm customer UI never displays provider names or key values.
5. Send harmless abuse/spam test text and confirm Salar remains polite and the conversation is flagged for admin review. Confirm harmful/illegal instruction requests are refused.
6. Block the conversation in Salar admin; confirm the visitor receives `403` and the unblock email is shown. Unblock and retest.
7. Open a second browser/incognito session and confirm it cannot retrieve the first session's conversation.
8. Try an unsupported image, an image over 4 MB, more than 10 uploads/minute, and more than 30 messages/minute; confirm rejection/rate limiting.
9. Complete the Phase 7 order flow and confirm staff see the website order even before the customer opens WhatsApp. Confirm delivery matches the existing website calculator.
10. With a stale/empty Salar index in a controlled test, confirm admin receives refresh-needed context while customer receives `03238878009`, not an empty catalogue or invented data.

## Release gate

**PUBLIC ON ONLY AFTER HUMANS MERGE.**

Do not enable `salar_public_enabled` on `feature/salar`. Do not merge this branch automatically. Public visibility requires human QA, explicit human merge/release approval, and a later intentional change that removes the admin-testing lock. Vercel deployment for this branch should remain disabled until the user explicitly approves deployment after all Salar phases are complete.
