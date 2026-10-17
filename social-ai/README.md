# PrimeHub Social AI — Local-first Social Content Studio

A **working**, zero-API-key social content planner for PrimeHubMall.

## Features
- Responsive dashboard, calendar and post library.
- Draft/create/edit/duplicate/delete posts with platform targeting.
- Plan future content and receive optional browser notifications **while the studio is open**.
- Save images/videos (15 MB/file) **privately on this browser** with IndexedDB; download for manual publishing.
- One-click copy caption + open official social publishing destinations (platform browser sessions persist only as the provider allows).
- Read-only search of the current public PrimeHubMall product catalog via a minimal serverless API.
- Workspace insights reflect **only saved posts**, not imagined social engagement.
- JSON export/import of text, schedules and settings; media is not included.
- Installable PWA with offline fallback for static resources.

## Clear boundaries
- This version **does not auto-publish** to Facebook/Instagram/TikTok/YouTube. Social login through a browser page is not authorization for a cloud bot to post.
- This version **does not provide a remotely persisted authenticated cloud browser** or run unattended scheduled video uploads. Those require separate secure browser infrastructure, platform-compliance review, storage/worker hosting and platform sign-in setup. API authorization is the preferred reliable route.
- The app **has no backend login**, because content is entirely client-side in the owner's local browser. Anyone visiting the URL starts with an empty, separate local workspace; no drafts are server-hosted. Do not advertise cloud sync.
- The website's existing production code, database and checkout are untouched.
- Store credentials are never requested or stored.

## Deployment
This application lives in `/social-ai` on a distinct feature branch for source control, and deploys into a **separate Vercel project** with Root Directory `social-ai`, Framework `Other` (static site + Node serverless `api/catalog.js`). No environment secrets are required. Vercel project is isolated from primehubmall.com.

## Developer quick check
```bash
cd social-ai
npm test
npm run check
```
A local static server can serve the UI; the `/api/catalog` endpoint runs only when served by Vercel-compatible functions.

## Future fully automated platform posting
Integrate each platform's authorized publishing API/OAuth, or a permitted cloud-worker browser flow with separate sign-in and session vault. Include scoped permissions, platform audit, user approval, quotas, retries, security controls and per-channel status. Never display a green 'connected' badge based on a browser shortcut or claim that a timed local reminder is an automatic published post.
