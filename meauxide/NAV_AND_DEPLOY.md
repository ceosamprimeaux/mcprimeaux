# MeauxIDE — Navigation repair & deployment

## What was fixed (minimal, no API/auth changes)

- **Single path → page map:** `getDashboardPageFromPath(pathname)` and `getViewAndNavIdsForPage(page)` so `/dashboard`, `/dashboard/projects`, `/dashboard/analytics`, etc. always resolve to the same view and nav highlight.
- **One place for segment rules:** `meauxmedia` → view `gallery`, `meauxide` → view `workspace`; both `applyRouteFromPath()` and `syncDashboardView()` use the same helpers so direct load (e.g. open `https://meauxide.inneranimalmedia.com/dashboard/analytics`) and in-app clicks stay in sync.
- **Worker SPA fallback (already in place):** For `GET /`, `/login`, `/dashboard`, `/dashboard/*` the Worker serves `index.html` so the client router can run. No R2/404 for dashboard deep links.

## Domains & routes (your setup)

- **Landing:** `https://meauxide.inneranimalmedia.com/` (already nice).
- **Dashboard:** `https://meauxide.inneranimalmedia.com/dashboard` (and `/dashboard/projects`, `/dashboard/analytics`, etc.).
- **Worker route:** `meauxide.inneranimalmedia.com/*` so the Worker runs for every request and can:
  - Serve `/api/*` from the Worker.
  - Serve SPA routes with `index.html`.
  - Serve other static assets (e.g. `auth-signin.html`, `meaux-themes.css`) from ASSETS.

## R2 bucket — do you need to add R2?

**No.** You already have an R2 bucket. In your dashboard you have **R2 bucket `IDE` (ide)**. In `wrangler.jsonc` the binding is `R2` with bucket `inneranimalmedia-assets`. For this navigation-only change we didn’t touch R2. Use your existing bucket for MeauxMedia, assets, and future project files. Only add another bucket if you want a separate one for a different purpose (e.g. separate “builds” bucket); not required for fixing /dashboard.

If the Cloudflare dashboard shows the bucket as **ide** but wrangler uses **inneranimalmedia-assets**, keep them in sync: either rename the bucket in the dashboard to match `wrangler.jsonc` or set `bucket_name = "ide"` in wrangler so both point at the same bucket.

## Deployment checklist (seamless, no data loss)

1. **Use the Worker for the app** (not “Pages only”) so SPA fallback runs. That means deploy with the config that has `main: "worker/index.ts"` and `assets: { directory: ".", binding: "ASSETS" }` (e.g. `wrangler.jsonc`).
2. **Build/deploy:** From repo root (or the directory that has `wrangler.jsonc` and `worker/index.ts`):  
   `npm run deploy` (or `npx wrangler deploy`).  
   That builds and deploys the Worker + assets; no need to “add R2” for navigation.
3. **Secrets / vars:** Cursor, Gemini, OAuth, Images, etc. stay in Cloudflare (Variables and Secrets). They are not in code, so redeploy won’t overwrite them.
4. **D1:** Same binding `DB` and database; migrations and data unchanged.
5. **After deploy:** Hard refresh or open a new tab and go to `https://meauxide.inneranimalmedia.com/dashboard` (and try `/dashboard/projects`, `/dashboard/analytics`). Sidebar and main content should match the URL; back/forward should work.

## If you use GitHub build (e.g. “Deploy command: npm run deploy”)

Ensure the GitHub build runs from the directory that contains `worker/index.ts` and `wrangler.jsonc`, and that the deploy step uses `wrangler deploy` (Worker + assets). If the repo is monorepo-style, set “Root directory” in the build config to the MeauxIDE app folder so the Worker and SPA are deployed together. No code changes to Cursor/Gemini/OAuth—only navigation and this doc.
