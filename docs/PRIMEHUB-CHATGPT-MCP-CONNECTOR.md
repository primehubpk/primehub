# PrimeHubMall personal ChatGPT plugin (read-only foundation)

## Scope
- Endpoint: `POST /api/mcp` with MCP Streamable HTTP JSON-RPC.
- Tools: `search_products`, `list_categories`, `get_product`.
- Sources: existing cached, public storefront catalog/category/product readers.
- Output: only public product fields. No customer, order, member, wallet, financial, or admin data.
- All operations are read-only. Never add admin writes without authenticated owner access and per-action approval.
- No secrets or new third-party packages required in this initial public-catalog stage.
- The endpoint is stateless and intentionally does not enable cross-site browser access.

## QA before enabling on ChatGPT
1. Deploy the feature branch to a Vercel preview (not production).
2. POST `{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"tester","version":"1.0"}}}` with Content-Type application/json and Accept application/json, text/event-stream to preview `/api/mcp`. Verify `serverInfo.name` is `primehubmall-store`.
3. POST `{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}` and verify three tools.
4. POST tool calls with a real category/product query and verify prices/photos/links match the public site. Check errors and no sensitive fields.
5. Test the modern `server/discover` with MCP-Protocol-Version 2026-07-28 and Mcp-Method server/discover.
6. Use MCP Inspector. Verify scanner compatibility, auth settings, and realistic queries.
7. Verify no unusual Supabase egress or Vercel function spikes before production.

## Register in ChatGPT
After a stable production or intentionally accessible preview endpoint exists, open ChatGPT on the **web**, go to **Plugins → + → Add custom MCP server**, name it **PrimeHubMall**, and provide `https://www.primehubmall.com/api/mcp` (only once route is deployed in production). For the read-only public catalog set **No authentication**. Review risk warning, create as a plugin, then install. Availability depends on account/workspace access.

## Next stage: owner-only operations
Protect owner administration with OAuth 2.1, scopes, audit logs, server-side authorization, idempotency, and explicit approvals. Do not reuse the existing privileged `PRIMEHUB_API_KEY` for a public, unauthenticated connector. Admin actions (orders, products, stock) must not be added to this public endpoint without those controls.

## Standalone social publishing app
For a personal Metricool-style dashboard, use a separate app or admin workstream with official platform OAuth/API access, provider review, a server-side posting queue and scheduler, R2 media assets, status/retry logs, and budget/rate-limit controls. TikTok video uploads require approved scopes and may be limited; do not assume scheduling APIs are available to all accounts.
