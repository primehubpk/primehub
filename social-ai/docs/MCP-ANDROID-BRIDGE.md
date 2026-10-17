# PrimeHub Social AI — ChatGPT MCP bridge (read-only)

**What this connector does:** exposes a public MCP endpoint that can generate a draft post handoff for the PrimeHub Social AI **Android** app. A user can ask ChatGPT for a post on TikTok, Facebook, Instagram, YouTube or Google Business; ChatGPT creates a review link, and the owner taps to open the Android app and **approves** saving the task.

This is a **real, testable MCP server**, but it is **not remotely controlling Android**.

## API

- Endpoint: https://primehub-social-ai-primehubmall.vercel.app/api/mcp
- Streamable HTTP: POST JSON-RPC 2.0; 2026-07-28 discovery/routing headers and legacy 2025-11-25 initialize.
- Tools:
  - \`prepare_android_post\` — prepares a text-only Android task review URL; returns \`requires_owner_approval:true\`, \`automatically_published:false\`.
  - \`android_bridge_capabilities\` — explains actual boundary of connection.
- All tools read-only: zero provider credentials, no Supabase/Vercel secrets, no session reading, no device scanning, no writes.
- Destination: the website's existing \`handoff.html\` turns URL parameters into a \`primehubsocial://import\` Android deep link. The native app explicitly asks for owner confirmation before saving locally.
- Link length limit: 4200 characters; never put sensitive data in caption/title because this is visible in URL history.
- No background queue, cloud device pairing or automatic social publishing. User needs to open the URL on the phone.

## Browser / plugin registration

To add the private MCP plugin (requires a ChatGPT account with custom plugin access):
1. Open https://chatgpt.com/plugins in a desktop browser/Work.
2. Press **Add → Custom MCP server**.
3. Name: \`PrimeHub Social AI\`; URL: \`https://primehub-social-ai-primehubmall.vercel.app/api/mcp\`; authentication \`None\` (public, stateless tools only).
4. Review the risk warning. Create and install the personal plugin.
5. Start a ChatGPT **Work** chat; select/mention \`@PrimeHub Social AI\` and ask: “Prepare a TikTok post for PrimeHubMall fancy bangles and send it to my Android task inbox.”
6. Check the returned HTTPS review URL, open it on an Android phone with the native app, then tap \`Open PrimeHub Social AI Android\` and **approve** the task.
7. Verify the task appears under AI Tasks. To publish, use the native platform app yourself; no background bot is operating.

**Do not claim successful ChatGPT installation until verified in user's account.** The plugin management connector currently cannot create a custom user plugin autonomously; the user must confirm the plugin creation in ChatGPT's UI.

## Hard boundary

**Installing a native Android app shortcut is not the same as an authorized account connector.** Android sandboxes apps. TikTok, Google Maps, Instagram etc. launch using the original app, but their logins remain inside those apps; neither the MCP server nor ChatGPT can control them simply by adding shortcuts.

For actual remote AI actions, a *separate*, owner-paired device companion would have to be built with narrowly scoped permissions, explicit per-operation user approval, authenticated transport, revocation, replay resistance, usage logs, and platform-compliant capability checks. Do not build a public endpoint exposing device commands or raw accessibility events. Prefer official integrations for Google Business Profile and social publishing where available.

## QA

\`\`\`bash
cd social-ai
node --test tests/social-mcp.test.mjs
\`\`\`

The isolated GitHub Actions QA workflow checks Node runtime, HTTP handler behavior, legacy/modern MCP discovery, read-only tool metadata, origin errors and rejects unauthorized tool names and invalid inputs.

**Do not merge into PrimeHubMall's original shopping \`main\` branch without separate approval.**
