# Salaar Virtual Salesman — 8 Phase Build

Branch: `feature/salaar-virtual-salesman`

## Build rules
- All eight phases stay on this one branch.
- No Vercel preview/production deployment from this branch while phases are in progress.
- Every phase is committed to GitHub and verified by branch CI (`npm ci`, lint, build).
- No merge to `main` until Phase 8 is complete and the full branch is reviewed.
- Real production data/flows only; no fake customer or demo business data in runtime code.
- Existing website design and working features remain untouched unless a phase explicitly targets Salaar.

## Phase 1 — Professional customer chat shell
- Replace the large launcher pill with a compact floating salesman avatar/icon and small `Need help?` label.
- Clean professional chat header and online/help presence.
- Keep current product cards, cart, chat history, polling, and backend behavior unchanged.
- Prepare the UI structure for later image upload and admin inbox controls without exposing unfinished controls.

## Phase 2 — Human Salesman Brain
- Remove brittle hard-lock assumptions from sales questions.
- Parse dynamic intent: category, product, budget, color, material, occasion, quantity, comparison, deal, wholesale, delivery, policy, order and follow-up references.
- Keep deterministic safety for facts that must never be invented.
- Use existing multi-provider LLM keys only when reasoning is needed; deterministic/cache tools answer simple factual/product filters first.

## Phase 3 — Store Knowledge Sync (future-proof)
- Build a cached Store Knowledge snapshot alongside Product Memory.
- Knowledge includes price buckets, Big Deal/current deals, categories, settings, delivery, wholesale/reseller, Prime Skill, policy/contact data and other store-managed information.
- Read knowledge from the real website/admin data sources, not duplicated hardcoded copies.
- Tag/invalidate relevant knowledge when admin-managed source data changes.
- Include a safety refresh/version mechanism so future admin-added categories, deals, settings or supported knowledge become available to Salaar automatically without adding a new hardcoded intent for every change.

## Phase 4 — Smart Catalog/Search Tools
- Structured filtering/ranking over cached catalog: exact/max/min/range price, category, color, material, tags, stock, deals, newest and combinations.
- 30 product/image cards per response where applicable.
- Continue with `aur/next/mazeed` without immediate repeats and preserve conversational search context.
- Live verification remains required for final price/stock/order actions.

## Phase 5 — Customer Image Messages + Vision
- Add image/camera attachment UI.
- Upload through the existing secure image storage path (R2 when appropriate), with size/type validation and safe server-side handling.
- Save image-message metadata in the Salaar conversation thread.
- Route image understanding only to a configured vision-capable provider/model; never expose provider API keys to the browser.
- Use image understanding to answer questions and to search for similar catalog items using extracted attributes.

## Phase 6 — Conversational Sales Memory
- Maintain session state for current product search, budget, category, color/style preferences, shown product positions, comparisons and cart context.
- Resolve follow-ups such as `gold mein`, `2nd wala`, `is jaisa aur`, and `thora sasta` using recent grounded context.
- Keep long-term storage bounded and avoid sending the full catalog/chat to the LLM.

## Phase 7 — Admin-only Salaar Inbox in Chat
- Detect authenticated admin server-side; customers never see admin controls.
- Show a three-line inbox icon only to authenticated admins.
- List real Salaar conversations, open full threads, view customer images, reply, pause/wait, resume/continue and inspect Need You/order state using existing admin Salaar APIs.
- Preserve customer/admin privacy boundaries and existing admin authentication.

## Phase 8 — Professional Salesman QA + Release Gate
- Test real scenarios: generic products, Rs 99/budget ranges, Big Deal, category/color/material, wholesale, delivery, policies, image questions, vague Roman Urdu, typos, follow-ups, comparisons, cart/order and outages.
- Verify cache invalidation, future knowledge sync, provider rotation/fallback, no hallucinated prices/facts and live checkout verification.
- Run final GitHub CI on the exact branch head.
- Only after Phase 8 completion should Vercel deployment be re-enabled for final preview and later `main` merge by explicit approval.

## API/provider rule
- Salaar does not need a separate public "website AI API key" in the browser.
- Website calls its own server routes; provider credentials stay server-side in environment variables.
- Existing Groq/OpenRouter/Gemini multi-provider keys are reused with provider/model capability routing and fallback.
- Vision tasks require at least one configured vision-capable provider/model; text-only providers remain useful for normal sales chat.
