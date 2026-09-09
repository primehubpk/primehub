# Salar — Phase 1 Foundation

Salar is being rebuilt cleanly inside the existing PrimeHub website. Phase 1 contains only admin-gated widget visibility, the admin public ON/OFF setting, and provider key rotation/ping. It does not fetch products or create orders.

## Environment variable names

Add values in Vercel or `.env.local`; never commit real keys.

- `GROQ_API_KEYS` — comma-separated Groq API keys.
- `GROQ_MODEL` — optional; fallback `llama-3.3-70b-versatile`.
- `GEMINI_API_KEYS` — comma-separated Gemini API keys.
- `GEMINI_MODEL` — optional; fallback `gemini-2.0-flash`.
- `OPENROUTER_API_KEYS` — optional, comma-separated OpenRouter API keys.
- `OPENROUTER_MODEL` — optional; may be empty.

## Rotation order

1. Groq keys, starting with the remembered last-good Groq index when still fresh.
2. Gemini keys after Groq is exhausted.
3. OpenRouter only when both optional OpenRouter key(s) and model are configured.
4. If all configured providers fail, return the safe Salar unavailable message and PrimeHub phone `03238878009`.

Keys rotate on rate-limit/quota/auth/billing/resource-exhausted responses. Raw keys are never returned or logged. The last-good provider/index is kept in server memory for about 15 minutes.

## Phase 1 public visibility

`settings/main.salar_public_enabled` defaults to `false`. The homepage widget is visible only when the request has a valid existing PrimeHub admin session, or when an admin deliberately turns this flag ON later. Phase 1 leaves it OFF.
