# Salar WhatsApp laptop adapter

Status: implemented and tested with simulated provider/Meta responses. Not installed on the owner's laptop, not connected to a verified Meta phone number, and not approved for live automatic replies yet. The website's existing production WhatsApp webhook is unchanged.

The local receiver verifies Meta signatures and persists inbound messages in SQLite before acknowledgement. One worker prepares replies through the existing Salar engine, live catalogue, Admin instructions and encrypted Admin provider credentials. Cloudflare/Gemma 4 remains the existing default; no copied business prices, offers, customer scripts or keys are embedded in this adapter. A quoted product photo resolves to the exact product for that sender. Native image messages are supported; voice, video and other unsupported types go to human review.

## Laptop setup

Use a separate clean feature-branch checkout. Preserve any dirty existing checkout. Requires Node 22.13+ (tests also run on Node 24), project dependencies, the existing authorized server environment, and a private configuration file outside Git.

1. Configure the variables listed in `config.example.txt` in a private env file. The Cloudflare Workers AI token and account ID stay in the existing Salar Admin credential store. A Cloudflare tunnel token is a separate credential; never reuse the Commander tunnel or point it at the Next server. Merely finding a saved token does not verify its permissions.
2. Start the Next server on loopback using the same private env file. For a development verification only: `node --env-file="<private-env-path>" node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3000`. A long-running deployment should use a verified production build and `next start` instead.
3. Start the adapter: `node --env-file="<private-env-path>" tools/salar-whatsapp/runner.mjs`.
4. Configure an authorized dedicated HTTPS tunnel to **127.0.0.1:8787 only**. In Meta, point the verified business number's webhook to `/webhook`, subscribe to message events, and verify the challenge. Never expose port 3000 or the private bridge route.
5. Keep `SALAR_WHATSAPP_SEND_ENABLED=false` for owner testing. Verify the actual incoming message, prepared reply and selected prices. This mode makes AI calls but sends nothing to WhatsApp. Review records intentionally hold later messages from that contact to prevent racing a human decision.
6. Enable automatic sends only after a real owner-number test and explicit live authorization. No broadcast, proactive outreach, template campaign, automatic order creation or payment verification is implemented.

## Operations and limits

- Each inbound message ID is deduplicated. The worker is single-process, with a local exclusive `runner.lock`; clean shutdown removes it. After a crash, verify the former process has stopped before manually removing a stale lock. Never run two workers on the same queue.
- `sent` means the Meta API accepted every outbound part; it does not prove device delivery/read. Delivery-status webhooks are acknowledged, not interpreted as customer messages.
- On an uncertain or partial outbound send, the item goes to `review`; it is never automatically resent. Inspect Meta receipts and the native conversation first. Only an operator may reconcile it and set the SQLite row to `resolved`; the adapter deliberately does not provide a blind retry-all command.
- Reply preparation failures retry up to three times with delay. Unsupported media, paused chats, expired service windows and draft-only results wait for human review. Other contacts continue.
- Prepared replies appear in Salar's chat history; that history is not delivery evidence. SQLite inbox/outgoing records are the adapter's transport record.
- Business data comes from the shared engine. The Next data cache is refreshed at 60 seconds and may serve its prior value during background refresh or an upstream failure; final stock, shipping quote, payment and order success need the transactional backend. This adapter cannot do those transactions and must not claim otherwise.
- Local SQLite contains customer conversations and phone numbers. Keep its directory private, outside Git/shared folders. Retention/deletion and a review dashboard remain future work; no automatic deletion policy is assumed.
- Live Cloudflare model access/billing, Meta permissions, the actual business phone ID, local secret loading, HTTPS tunnel, mobile zoom/UI and end-to-end WhatsApp delivery remain unverified until laptop setup. The supplied business number must be mapped to a verified Meta phone-number ID; a phone number string is not that ID.

## Validation

`node --test tests/salar-*.test.mjs` includes model-context regressions, real local HTTP signature/deduplication checks with synthetic messages, queue safety and simulated delivery outcomes. `npx tsc --noEmit` checks the shared Next bridge.
