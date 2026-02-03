# MeauxIDE: Analytics, Cursor vs R2, and Stack Overview

**Purpose:** One reference for you and Agent_Sam: what we track, what’s manual vs automatic, how to improve analytics UI/UX and reliability, whether GitHub is required for Cursor, and how an all-Cloudflare (R2/D1/Workers) CI/CD fits your 10–20 projects.

---

## 1. What We’re Tracking (Analytics Today)

### 1.1 Finance (`finance_entries` in D1)

| What | How it gets data | Automated? |
|------|------------------|------------|
| **Income/expense** | You (or UI) POST to `/api/analytics/finance` or use “Add finance entry” on Analytics page | **No** – 100% manual |
| **By month** | D1 query from `finance_entries` (date, amount, category) | Yes (once data exists) |
| **By category** | Same table, grouped by category | Yes (once data exists) |

**Gap:** No automation. Every subscription (Cursor Pro, Claude, ChatGPT, etc.) and one-off cost has to be entered by hand. If you don’t update daily, charts are stale.

### 1.2 Neurons / AI spend (`ai_usage_log` in D1)

| What | How it gets data | Automated? |
|------|------------------|------------|
| **Workers AI** (RAG, `/api/ai/generate`) | Worker calls `logAiUsage()` after each request | **Yes** – automatic |
| **Cursor** | You upload Cursor usage CSV (export from Cursor) → `POST /api/analytics/neurons/import` | **No** – manual CSV import |
| **Gemini / others** | Not integrated yet; would need same pattern (API or CSV) | No |

**Gap:** Cursor spend is only in analytics after you export usage from Cursor and import the CSV. No daily pull from Cursor API (Cursor may not expose a “usage this month” API we can poll).

### 1.3 Other “analytics-adjacent” data

- **User goal** (car/savings): Stored in D1 `user_goals`; UI can read/write. Manual.
- **Cursor spend cap**: Stored in D1 `user_settings`; you set it in UI; Worker uses it for display/warnings. Manual.
- **Dashboard counts**: Agent configs, sessions, commands from D1. Automatic (reads existing tables).

---

## 2. How to Improve Analytics (Functional, Not Manual-Daily)

### 2.1 Make tracking more automatic

1. **Finance**
   - **Recurring entries:** Add a “recurring” table (e.g. “Cursor Pro $21.80/month”) and a **cron Worker** (e.g. daily) that inserts that month’s line into `finance_entries` so you don’t have to add Cursor/Netflix/etc. by hand.
   - **Optional:** Webhook or “email forward → parse” for key invoices (depends on what providers support).
   - **UI:** “Add recurring” in Analytics so you define once; backend or cron creates the actual entries.

2. **Neurons (AI spend)**
   - **Workers AI:** Already auto-logged; keep it.
   - **Cursor:** If Cursor ever adds a “usage API” (e.g. GET usage for account), add a **scheduled Worker** (cron) that calls it and inserts into `ai_usage_log`; then Cursor would be automatic too. Until then, CSV import is the only option; we can make it easier (e.g. “Import Cursor CSV” once a week).
   - **Gemini (future):** Same idea: API or CSV; prefer API + cron if available.

3. **Cron / scheduled Worker**
   - Add `triggers: { crons: ["0 8 * * *"] }` (or similar) in `wrangler.jsonc`.
   - Handler: (1) generate recurring finance rows for the current period, (2) if/when Cursor usage API exists, fetch and insert into `ai_usage_log`.
   - Result: Analytics stay up to date without you “manually updating daily.”

### 2.2 Better UI for analytics

- **Single “Analytics” home:** One screen: Finance summary + Neurons summary + “what’s automated vs manual” (e.g. “Workers AI: auto | Cursor: import CSV”).
- **Time range + comparison:** Keep 7/30/90/all; add “compare to previous period” (e.g. this month vs last month) so you see trend without mental math.
- **Alerts:** Optional: “Notify me if Cursor spend &gt; $X” or “if finance category &gt; $Y” (e.g. email or in-app); can be a later phase.
- **Recurring management:** If you add recurring finance entries, a small “Recurring” sub-section in Analytics to add/edit/disable them.

---

## 3. Cursor Agent: Is GitHub Required? Can We Use R2?

### 3.1 What the Cursor API requires today

The **Cursor Cloud Agent API** (`POST https://api.cursor.com/v0/agents`) that MeauxIDE calls expects:

- `prompt.text` – what the agent should do.
- `source.repository` – **GitHub repo URL** (e.g. `https://github.com/owner/repo`).
- `source.ref` – branch/ref (e.g. `main`).

So **today, Cursor’s API is built around a Git repository (GitHub)**. It does not accept an R2 URL or “point at this R2 prefix” as the codebase. So for the **existing “Run Cursor Agent” button** in MeauxIDE:

- **Yes, a GitHub repo is effectively required** for that exact Cursor API.
- We cannot “swap in” an R2 path instead of `source.repository` for that endpoint.

### 3.2 R2 “methodology” – your own agent, no Cursor API

You can still use an **R2-centric workflow** without Cursor’s agent API:

- **Source of truth:** Code and assets live in **R2** (e.g. by project: `projects/<name>/...`). Optionally metadata/versions in **D1**.
- **Your own “run agent” / automation:** A **Worker** (or a separate small service) that:
  - Reads from R2 (and D1) for context.
  - Uses **Workers AI** (and/or later Gemini) to do tasks: “summarize this,” “suggest changes,” “generate a migration.”
  - Writes results back to R2/D1 or returns them to the UI.
- **No GitHub in the loop:** Build/deploy from R2: Worker or Pages that serve from R2, or a Worker that deploys (e.g. writes to another bucket or triggers a deploy). That’s your “CI/CD” on Cloudflare.

So: **Cursor’s agent = GitHub-based. Your R2 methodology = your own agent + R2 + D1 + Workers AI (and optionally Gemini), no GitHub required.**

### 3.3 Feasibility: All-Cloudflare “GitHub-like” CI/CD for 10–20 projects

**Yes, it’s feasible** for your scale (you + 10–20 projects, all R2/D1/Workers/minimum):

1. **Versioning**
   - **R2:** One bucket (or prefix per project): e.g. `projects/<project-id>/v1/`, `v2/`, or by date. You don’t need Git; you need “this set of files at this path” and maybe a D1 row: `project_id, version, r2_prefix, created_at`.
   - **D1:** Table e.g. `project_versions (project_id, version_label, r2_prefix, created_at)` so you know “current” and “history.”

2. **Build / deploy**
   - **Option A:** Worker that copies from R2 “source” prefix to “deploy” prefix (or another bucket) and invalidates cache if you use a CDN.
   - **Option B:** Worker that runs a simple “build” (e.g. run a bundler in a Worker, or call an external build API) and writes output to R2; then your app serves from that.
   - **Option C:** Use **Cloudflare Pages** with a “direct upload” or API that accepts a zip; Pages can build from that. You could have a Worker that uploads from R2 to Pages (if Pages API supports it) or that triggers a build.

3. **No GitHub**
   - MeauxIDE UI: “Deploy this project” = pick project (from D1), pick version (from D1/R2), trigger a Worker that does the copy/build/deploy steps above.
   - “Cursor agent” for that flow = **your** agent (Workers AI + R2/D1 context), not Cursor’s Cloud Agent. Cursor’s agent stays for repos you do use (if any).

4. **Summary**
   - **Cursor Run Agent (current):** GitHub required; keep for the repos you care to use.
   - **Your workflow:** R2 as source, D1 for metadata/versions, Workers for “run agent” + deploy; no GitHub required. Fully feasible for 10–20 projects.

---

## 4. What We Have vs What We Want (Concise)

### 4.1 What we have

| Area | Current state |
|------|----------------|
| **Analytics – Finance** | D1 + UI; manual entry only; charts by month/category. |
| **Analytics – Neurons** | Workers AI auto-logged; Cursor via CSV import; charts by day/provider/account. |
| **Automation** | None: no cron, no auto recurring, no Cursor API pull. |
| **Cursor agent** | “Run Cursor Agent” calls Cursor API with **GitHub repo URL**; required by Cursor. |
| **R2** | List/GET/PUT/DELETE via `/api/r2/...`; used for assets, MeauxMedia, etc. |
| **Versioning** | No formal R2 versioning or “project versions” in D1 yet. |
| **CI/CD** | UI says “R2-based versioning”; no actual deploy-from-R2 pipeline yet. |

### 4.2 What we want (from your description)

- **Analytics:** Reliable, functional tracking without “manual update daily”; better UI and clear automation vs manual.
- **Cursor:** Use where it makes sense; **not** required for your main workflow.
- **R2-first:** Source of truth in R2 (+ D1); own “agent” and deploy path; optional GitHub.
- **UI/UX:** Clean analytics, one place to see spend and trends; refine overall MeauxIDE UI/UX.
- **Backend:** Recurring finance, optional cron, R2 versioning + simple deploy so your 10–20 projects are manageable.

### 4.3 How to get there (efficiently)

1. **Analytics**
   - Add **recurring finance** (table + UI “Add recurring”) and a **cron Worker** that inserts monthly entries.
   - Keep CSV import for Cursor; document “import once a week” until Cursor has a usage API.
   - Improve analytics UI: one dashboard, clear “auto vs manual” labels, optional “vs previous period.”

2. **R2 + “your” agent**
   - Define **project versions** in D1 (e.g. `project_versions`) and R2 prefixes (e.g. `projects/<id>/v/<version>`).
   - Add a **“Run agent”** path that uses **Workers AI (and RAG)** with context from R2/D1 (e.g. “list files under this project prefix,” “summarize,” “suggest”) – no Cursor API, no GitHub.
   - Keep “Run Cursor Agent” for GitHub repos only; make it clear in UI: “For GitHub repos. For R2 projects, use Run agent below.”

3. **CI/CD (minimal)**
   - One Worker: “Deploy project X version Y” = copy R2 source → deploy path (or trigger a build step), update D1 “current” version. No GitHub required.
   - Optional: Pages or another product for hosting; Worker can still orchestrate “what to deploy” from R2/D1.

4. **UI/UX**
   - Analytics: single overview, better charts (already fixed “melting”), time range + “vs last period.”
   - Projects: link projects to R2 prefix and optional “current version”; “Deploy” button that triggers the Worker above.
   - Clear separation: “Cursor (GitHub)” vs “MeauxIDE agent (R2/D1).”

---

## 5. Agent_Sam: How to Use This Doc

- **When asked “what are we tracking?”** → Section 1.
- **When asked “how to improve analytics?”** → Section 2 (automation + UI).
- **When asked “is GitHub required for Cursor?”** → Section 3.1 (yes for Cursor API); Section 3.2–3.3 (R2 alternative and all-Cloudflare CI/CD).
- **When asked “what do we have / want?”** → Section 4.
- **When implementing:** Recurring finance + cron (2.1, 4.3); R2 versioning + “Run agent” from R2 (3.2, 4.3); analytics UI tweaks (2.2, 4.3).

This gives you and the agent a single, accurate picture of the stack and a clear path to refine UI/UX and backend without relying on daily manual updates or on GitHub for your main workflow.
