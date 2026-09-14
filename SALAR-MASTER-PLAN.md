# Salar Master Plan

## Product outcome

Salar is one trained, customer-facing PrimeHub Mall salesman. Groq, Gemini, and OpenRouter are interchangeable engines behind Salar; customers never see provider names. Salar owns the conversation and calls one controlled Worker when he needs verified website knowledge or an action.

## Customer experience

- Launcher: Salar avatar with “Need help?”.
- Chat controls: admin hamburger, minimize, maximize/full screen, close; responsive on desktop and mobile.
- Admin drawer: all chats, delete, block/unblock, and moderation flags.
- Blocked customer sees Blocked and can request unblock at primehubpk1@gmail.com.
- Quick area: Images, Reseller Club, Prime Skill, Shopping.
- Tone: warm, sweet, respectful Roman Urdu/Urdu/English, concise, one question at a time.

## Salar and Worker responsibilities

Salar:
- Understand intent, maintain context, choose the next question, and explain verified results warmly.
- Never invent website facts or expose AI provider details.
- Use recent product cards to understand “this picture”, “first”, “second”, size, material, and order references.

Worker:
- moderate: local safety/spam classification before model usage.
- catalogue: cached collection/product lookup from the refreshed website index.
- knowledge: delivery, payment, contact, policy, Reseller Club, Prime Skills, and shopping facts.
- vision: inspect a trusted uploaded image and match only against verified product candidates.
- order: authoritative totals, delivery charges, idempotent website order creation, and WhatsApp handoff.

## Shopping and order flow

1. Customer asks for bangles or another broad need.
2. Salar calls catalogue, lists all matching collection names, and asks which one to open.
3. Worker returns up to 30 verified products with image, price, size, material, and URL.
4. Follow-up questions resolve against those cards and re-check the exact product.
5. Order intent selects a verified product.
6. Salar requests Rs 300 advance screenshot; status remains pending staff verification.
7. Salar collects name, city, phone, and complete address one field at a time.
8. Worker calculates website delivery/total and creates the website order idempotently.
9. Chat renders the complete summary and Place Order button.
10. Button opens WhatsApp; the website order already exists even if the button is not pressed.
11. Team prepares the complete order, shares video, and collects remaining payment after video.

## Knowledge and cache

- Admin Brain files contain behavior, tone, business rules, and escalation policy.
- New rules are appended below existing rules; create a new Brain file when one becomes large.
- Catalogue Refresh reads current products, collections, Prime Skills, website pages, delivery, payment, policies, and contact settings.
- Refresh replaces the index and clears the 15-minute query cache.
- Salar checks cache first and never sends the full catalogue to an AI provider.
- Missing/stale facts produce the customer contact 03238878009, never guesses.

## Provider reliability

1. Groq keys/models.
2. Gemini keys/models.
3. OpenRouter keys/models.
4. Singular and plural Vercel env names are accepted.
5. Configured models are tried first; supported fallbacks protect against model retirement.
6. Auth, quota, model, timeout, network, and provider failures move to the next safe attempt.
7. Logs contain provider, model, key slot number, status, and error code only—never keys or customer prompts.
8. Admin provider ping reports the active provider/model; customer UI does not.

## Data and security

- HttpOnly visitor session cookie maps server-side to one conversation.
- Firebase ID token is verified when present; conversation IDs are not trusted from clients.
- Admin routes use the existing admin session boundary.
- Rate limits: 30 messages/minute and 10 uploads/minute per conversation.
- Uploads: JPEG/PNG/WebP, maximum 4 MB, trusted R2 public URLs only.
- Database writes remain authoritative and Supabase mirrors follow existing migration rules.
- No service key, provider key, or admin secret may use a NEXT_PUBLIC name.
- Exposed Supabase tables require least-privilege grants plus RLS.

## Release and proof gate

The exact feature/salar preview may be public for QA. Main/production remain unchanged until explicit human merge approval. Release is complete only when evidence confirms:

- logged-out desktop and mobile widget visibility and controls;
- session and message APIs;
- active Groq answer plus tested fallback behavior;
- catalogue refresh, first request, and cache hit;
- broad bangles → collections → 30-product flow;
- product-card reference questions;
- upload/vision handling;
- Rs 300 → details → website order → WhatsApp flow;
- admin chat list/delete/block/unblock;
- rate limits and unsafe-request refusal;
- no provider keys/prompts in logs and no production branch change.
