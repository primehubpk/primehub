# Salar

Salar is implemented inside the existing PrimeHub website. `feature/salar` remains private/testing until the admin explicitly changes the stored visibility flag in a later approved release.

## Environment variable names

- `GROQ_API_KEYS` — comma-separated keys
- `GROQ_MODEL` — optional; fallback `llama-3.3-70b-versatile`
- `GEMINI_API_KEYS` — comma-separated keys
- `GEMINI_MODEL` — optional; fallback `gemini-2.0-flash`
- `OPENROUTER_API_KEYS` — optional comma-separated keys
- `OPENROUTER_MODEL` — optional

Never commit values for these variables.

## Provider rotation

Text/vision provider attempts are ordered: Groq keys in configured order, then Gemini keys, then OpenRouter if configured. Retry/failover applies to rate-limit, auth, quota/billing, and resource-exhausted failures. The server remembers the last successful provider/key index for about 15 minutes. Raw keys are never returned or logged.

## Phase 2 chat persistence

- Firestore collections: `salar_conversations` and `salar_messages`.
- Guest identity is an HttpOnly `salar_sid` UUID cookie, Secure in production, with a one-year lifetime.
- Visitor message/history APIs resolve the conversation from that cookie only; they do not trust a caller-provided conversation id.
- Logged-in Firebase customers can have their verified UID attached when the widget sends their Firebase ID token.
- Admin list/open/delete/block/unblock routes reuse the existing PrimeHub admin cookie auth.
- Blocked conversations are rejected server-side with HTTP 403 and unblock email `primehubpk1@gmail.com`.
- Message POST rate limit: 30 per minute per conversation (in-memory runtime limiter for this phase).
- `salar_public_enabled` remains default false and is not changed by Phase 2.
