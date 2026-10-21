# PrimeHub Workspace Instructions for Coding and Desktop Agents

These operating rules apply to all PrimeHubMall / PrimeHub Deals project work.

## Chrome session and customer laptop safety (mandatory)

- **Do not close either of the two Google Chrome windows or profiles that the owner has already opened.** Their browser sessions, tabs, logins and personal work must remain open and untouched.
- The owner-facing Chrome windows include their Vercel dashboard and ChatGPT browser. Never close these windows or shut down all Chrome processes.
- Only use a **separate Chrome window/profile owned by the assistant** for PrimeHub development/Play Console/other authorized tasks (the owner's `primehubpk` assistant profile when available).
- After a task, **close only the assistant-owned Chrome window(s)** opened for that task. Identify the exact window by title, profile, or process before closing; do not guess.
- Never run `taskkill /IM chrome.exe`, `Stop-Process -Name chrome`, `pkill chrome`, browser-wide quit commands, or any equivalent operation that would close the owner's windows.
- If it is unclear whether a Chrome window belongs to the assistant, leave it open and ask the owner. Avoid disrupting the user's mouse/active window.

## Production and performance protection

- PrimeHubMall is a live shopping website and Play Store app. Keep existing instant-feeling navigation, page load performance, working features, product variants, checkout, cashback, and SEO intact.
- Trace the exact relevant files and project settings before making changes. Do not modify unrelated files or alter live configuration on assumptions.
- For Vercel usage issues, establish whether metrics are **team-level** (multiple projects) or project-level before attributing usage to PrimeHubMall.
- Diagnose ISR Writes, Fluid Active CPU, traffic and bots using measurable evidence; do not disable caching, change revalidation intervals, enable paid features, increase plan limits, or alter Vercel settings without confirming the trade-offs.
- Preserve Vercel's existing Ignored Build Step configuration. Avoid redundant preview or production deployments.
- Use an isolated feature branch for code/config changes. Verify TypeScript, builds, important checkout/navigation behavior and preview speed before requesting approval to merge to `main`.
- No merge to `main` or production deployment without the owner's explicit approval for the tested change.

These instructions are operational guidance; they do not change deployed application logic by themselves.
