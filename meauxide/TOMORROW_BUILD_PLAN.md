# MeauxIDE — Tomorrow's Build Plan

Step-by-step checklist for you and the team to get MeauxIDE fully built.

---

## Before You Start

- [ ] Ensure everyone has access to the repo and Cloudflare account (or wrangler OAuth)
- [ ] Run `cd meauxide && npx wrangler whoami` to confirm auth
- [ ] Split tasks among team members (suggested owners below)

---

## Phase 1: Core Product (Must-Have)

### 1.1 Add "Add Finance Entry" Form on Analytics Page

**Owner:** Frontend  
**Time:** ~30 min

1. Open `meauxide/index.html`
2. In the Finance section (around line 195), add a collapsible "Add entry" form above or below the charts:
   - Fields: Date (default today), Amount (number), Category (text or select), Description (optional)
   - Button: "Add" → `POST` to `/api/analytics/finance` with `{ date, amount, category, description }`
   - On success: call `ide.loadAnalytics()` to refresh charts; clear form
   - On error: show alert or inline message
3. Test: Add an entry, verify it appears in the Finance charts

**Reference:** `POST /api/analytics/finance` expects `{ "date": "YYYY-MM-DD", "amount": number, "category": string, "description?": string }`

---

### 1.2 Wire Featured Project Links to Real URLs or Routes

**Owner:** Frontend / Product  
**Time:** ~20 min

1. Decide where each app lives:
   - MeauxGames: URL or path (e.g. `https://meauxgames.example.com` or `#/meauxgames`)
   - MeauxCAD: URL or path
   - MeauxSQL: URL or path
2. In `index.html`, find the three featured project cards (MeauxGames, MeauxCAD, MeauxSQL)
3. Replace `href="#"` with the real `href` for each card
4. If apps are external: use `target="_blank"` and `rel="noopener"` if desired
5. Test: Click each card and confirm it navigates correctly

---

### 1.3 Seed Vectorize So RAG Is Useful

**Owner:** Backend / DevOps  
**Time:** ~45 min

1. Gather content to index (e.g. MeauxIDE docs, FAQs, project summaries, README snippets)
2. Create a seed script or use curl/Postman to call:
   ```
   POST /api/vectorize/insert
   Body: { "id": "doc-1", "text": "Your content here...", "metadata": { "source": "readme" } }
   ```
3. Repeat for each chunk of content (keep chunks ~500–1000 chars for good retrieval)
4. Test: Open agent_sam drawer, ask a question that should be answered from the seeded content; verify the answer references it

**Alternative:** Add a one-off Worker route or script that reads from a file/R2 and bulk-inserts into Vectorize.

---

## Phase 2: Reliability & Data

### 2.1 Verify D1 Data for Projects & Library

**Owner:** Backend  
**Time:** ~15 min

1. Run: `npx wrangler d1 execute inneranimalmedia-business --remote --command "SELECT COUNT(*) FROM agent_configs; SELECT COUNT(*) FROM agent_commands;"`
2. If counts are 0, run your existing seed scripts (e.g. `seed-agent-sam-ide-d1.sql` or equivalent)
3. Reload MeauxIDE Projects and Library pages; confirm data appears

---

### 2.2 Add GitHub Action for Deploy on Push

**Owner:** DevOps  
**Time:** ~30 min

1. Create `.github/workflows/deploy-meauxide.yml` in the repo root (or in `meauxide/` if it's a sub-project)
2. Use a workflow that:
   - Triggers on `push` to `main` (or your deploy branch)
   - Checks out the repo
   - Runs `cd meauxide && npm install` (if needed) and `npx wrangler deploy`
   - Uses `CLOUDFLARE_API_TOKEN` as a GitHub secret (create at Cloudflare Dashboard → My Profile → API Tokens)
3. Ensure the token has: Workers Scripts Edit, Account Read, D1 Edit, R2 Edit (or equivalent)
4. Push to `main` and confirm deploy runs in GitHub Actions

**Reference:** [Cloudflare Workers GitHub Action](https://github.com/cloudflare/wrangler-action)

---

## Phase 3: Auth (Optional but Recommended)

### 3.1 Add Cloudflare Access or Simple Auth

**Owner:** DevOps / Security  
**Time:** ~1 hr

**Option A — Cloudflare Access (easiest):**

1. In Cloudflare Dashboard → Zero Trust → Access → Applications
2. Add an application for `meauxide.meauxbility.workers.dev`
3. Create a policy (e.g. email ends with `@yourdomain.com` or specific emails)
4. Require login before the Worker is reached

**Option B — Worker-based auth:**

1. Add a simple cookie/session check in the Worker's `fetch` handler
2. If no valid session, return 401 or redirect to a login page
3. Add a login route that validates credentials (e.g. against D1 or env vars) and sets a signed cookie
4. Document the flow in `worker/README.md`

---

## Phase 4: Polish

### 4.1 Add 404 Handling in Worker

**Owner:** Backend  
**Time:** ~10 min

1. In `meauxide/worker/index.ts`, ensure unknown paths return a proper 404
2. For asset requests: `env.ASSETS.fetch(request)` typically handles this; verify
3. For `/api/*` unknown paths: already returns `{ error: "Not found" }` with 404; confirm behavior

---

### 4.2 Improve "No Data" UX on Analytics

**Owner:** Frontend  
**Time:** ~15 min

1. In `loadAnalytics()`, when `f.rows.length === 0` and `n.rows.length === 0`, show a friendly message in the Finance and Neuron sections
2. Example: "No data yet. Add a finance entry or use agent_sam to start tracking."
3. Ensure the note about running migrations is visible when tables don't exist (already in place; verify it displays)

---

### 4.3 Document Workspace Behavior

**Owner:** Product / Docs  
**Time:** ~10 min

1. In the Workspaces page or README, add a short note: "Workspace isolation is informational. Each workspace uses its own D1/R2 bindings when implemented."
2. If you implement workspace switching (e.g. via query param), document the URL format and behavior

---

## Phase 5: Final Checks

### 5.1 End-to-End Test

**Owner:** QA / Team lead  
**Time:** ~30 min

- [ ] Open MeauxIDE, navigate all pages (Dashboard, Projects, Library, Workspace, Workspaces, Analytics)
- [ ] Add a finance entry via the new form; verify it appears in charts
- [ ] Open agent_sam, ask a question; verify RAG responds (and Neuron chart updates)
- [ ] Change theme; verify UI updates
- [ ] Test on mobile (hamburger, drawer, touch targets)
- [ ] Push to `main`; confirm GitHub Action deploys successfully

---

### 5.2 Deploy & Verify Live

**Owner:** DevOps  
**Time:** ~10 min

1. Run `cd meauxide && unset CLOUDFLARE_API_TOKEN && npx wrangler deploy` (or let CI deploy)
2. Visit `https://meauxide.meauxbility.workers.dev`
3. Confirm all changes are live and functional

---

## Quick Reference

| Item | Location / Command |
|------|-------------------|
| MeauxIDE live URL | https://meauxide.meauxbility.workers.dev |
| Worker code | `meauxide/worker/index.ts` |
| UI | `meauxide/index.html` |
| Analytics migration | `meauxide/migrations/0001_analytics_tables.sql` |
| D1 DB name | `inneranimalmedia-business` |
| Deploy (manual) | `cd meauxide && unset CLOUDFLARE_API_TOKEN && npx wrangler deploy` |
| D1 execute | `npx wrangler d1 execute inneranimalmedia-business --remote --file=./migrations/0001_analytics_tables.sql` |

---

## Estimated Total Time

- **Phase 1:** ~1.5 hr  
- **Phase 2:** ~45 min  
- **Phase 3:** ~1 hr (optional)  
- **Phase 4:** ~35 min  
- **Phase 5:** ~40 min  

**Total:** ~4–5 hours (with auth); ~3 hours (without auth)

---

*Last updated: Feb 3, 2026*
