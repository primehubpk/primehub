# Salaar Never-Fail Master Plan

Goal: keep Salaar acting like one professional human salesman even when a provider key, AI provider, Firestore, Supabase, or a transient dependency has a problem. Providers are helpers; Salaar remains the orchestrator and PrimeHub data remains the source of truth.

## Phase 1 — Brain routing and confidence
- Keep Salaar as the main orchestrator.
- Use deterministic grounded replies for high-confidence/simple store flows.
- Automatically call AI for low/medium-confidence, ambiguous, reasoning-heavy, comparison, recommendation, deal, and vision turns.
- Never let an AI provider invent product, price, stock, deal, discount, policy, or store facts outside supplied grounded context.
- Preserve bounded conversation/sales memory and quoted-product grounding.

## Phase 2 — Multi-provider resilience
- Keep Groq, OpenRouter, and Gemini multi-key rotation.
- Add per-key failure tracking and temporary cooldown so a bad/rate-limited key is not retried on every customer turn.
- Add request timeouts so one slow provider cannot stall the entire chat.
- Reset a key's failure state after success.
- Continue to the next usable key/provider automatically.
- Expose only safe aggregate health (configured/available/cooling key counts), never API key values.

## Phase 3 — Catalog/data resilience
- Supabase remains the preferred live read source with Firebase fallback according to configured read mode.
- Keep a process-level last-known-good Salaar catalog snapshot.
- Persist a compact last-known-good catalog snapshot to Cloudflare R2 after successful live refreshes.
- On a temporary dual-backend outage, serve memory last-good first, then R2 last-good, instead of making the entire chat fail.
- READY/order final verification must continue using the uncached live path so stale price/stock is never used to confirm an order.
- If no trustworthy catalog exists at all, Salaar stays conversational but does not invent products/prices.

## Phase 4 — Never-fail QA and observability
- Add a safe Salaar brain-health endpoint for provider/key availability and routing policy state.
- Extend catalog health to report degraded/backup source clearly.
- Add smoke coverage for confidence-based AI routing, provider cooldown/timeouts, catalog backup fallback wiring, and no secret exposure.
- Preserve all Phase 2–9 behavior and the selected human Salaar avatar.
- Vercel Preview must reach READY before merge to main.

## Non-negotiable rules
1. Customer talks only to Salaar; provider names are implementation detail.
2. Salaar may use AI to understand/reason, but live PrimeHub data owns factual store truth.
3. Provider failure must rotate automatically.
4. Persistence failure must not stop normal conversation.
5. Database outage must prefer a trustworthy last-known-good catalog over a technical-error customer message.
6. Sensitive order/payment uncertainty may still escalate to human support.
7. No merge to main until preview and regression checks pass.
