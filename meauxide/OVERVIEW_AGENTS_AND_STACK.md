# MeauxIDE + AI-CLI — Stack Overview & Agent Alignment

Detailed overview of what’s built (backend, GUI, CLI), and how to **solidify** so GUI / CLI / IDE / Workers AI / Cursor (and soon Gemini + OAuth) share one source of truth and **zero wasted AI work**.

---

## 1. Backend (MeauxIDE Worker)

**Stack:** Cloudflare Worker, D1, R2, Workers AI, Vectorize. Optional: `CURSOR_API_KEY` secret.

**Base URL (live):** `https://meauxide.meauxbility.workers.dev`

### 1.1 API Routes (all under `/api/`)

| Path | Method | Description |
|------|--------|-------------|
| `health` | GET | D1 ping; `{ ok, db, ping }` |
| `dashboard` | GET | Counts: agent_configs, active_sessions, agent_commands from D1 |
| `projects` | GET | List from `agent_configs` (id, name, slug, description, config_type, status, version, updated_at) |
| `library` | GET | List from `agent_commands` (id, name, slug, description, category, status, usage_count, updated_at) |
| `analytics/finance` | GET | Finance entries; `?days=7|30|90|all`; returns summary, byMonth, byCategory, rows |
| `analytics/finance` | POST | Insert finance entry `{ date, amount, category, description? }` |
| `analytics/neurons` | GET | AI usage from `ai_usage_log`; `?days=...`; returns summary (totalCost, totalTokens, count), byDay, byProvider, byAccount, rows |
| `analytics/neurons/import` | POST | Bulk import Cursor usage events `{ account, provider?, events[] }` into `ai_usage_log` |
| `user/goal` | GET | User goal row (e.g. car/savings: goal_saved, goal_paid_off, goal_owed, goal_monthly_payment, goal_target_label) |
| `user/goal` | PUT/PATCH | Upsert user goal (same fields) |
| `r2/<key>` | GET | R2 get object; GET with no key = list objects |
| `r2/<key>` | PUT | R2 put object (body + optional Content-Type) |
| `r2/<key>` | DELETE | R2 delete object |
| `ai/generate` | POST | Workers AI chat `{ prompt, system? }` → `{ response }`; logs to `ai_usage_log` |
| `vectorize/query` | POST | Vectorize search `{ vector, topK? }` → `{ matches }` |
| `vectorize/insert` | POST | Embed text (Workers AI) + upsert into Vectorize `{ id?, text, metadata? }` |
| `rag` | POST | AutoRAG: embed question → Vectorize → Workers AI with context `{ question, topK? }` → `{ response, retrieved, ids }`; system prompt = "agent_sam"; logs to `ai_usage_log` |
| `cursor/status` | GET | `{ configured: bool, links, note }` (does not expose key) |
| `cursor/spend-cap` | GET | `{ spend_cap_monthly }` from `user_settings` |
| `cursor/spend-cap` | PUT/PATCH | Set/clear spend cap `{ spend_cap_monthly? }` |
| `cursor/agent` | POST | **Cursor Cloud Agent**: proxy to `https://api.cursor.com/v0/agents` with Bearer `CURSOR_API_KEY`; body `{ prompt: { text }, source: { repository, ref }, model? }` |
| `cursor/models` | GET | List Cursor models (proxy to Cursor API) |

### 1.2 D1 Database: `inneranimalmedia-business` (binding `DB`)

| Table | Purpose |
|-------|---------|
| `agent_configs` | Agent definitions (e.g. agent_sam IDE Assistant); used by Dashboard + Projects |
| `agent_sessions` | Active sessions (counts on Dashboard) |
| `agent_commands` | Command/library entries (Library page) |
| `finance_entries` | Income/expense (Analytics → Finance) |
| `ai_usage_log` | Per-call AI usage: provider, model, tokens, cost_estimate, endpoint, **account** (Cursor email etc.) |
| `user_goals` | Single row `id='default'`: car/savings goal (goal_saved, goal_paid_off, goal_owed, goal_monthly_payment, goal_target_label) |
| `user_settings` | Key-value (e.g. `cursor_spend_cap_monthly`) |

Migrations: `0001_analytics_tables.sql`, `0002_user_goals.sql`, `0003_ai_usage_account.sql`, `0004_user_settings.sql`.

### 1.3 Other Bindings

- **R2** `inneranimalmedia-assets`: file storage; API under `/api/r2/...`.
- **Workers AI**: embed `@cf/baai/bge-base-en-v1.5`, chat `@cf/meta/llama-3.1-8b-instruct`; used by `/api/ai/generate`, `/api/rag`, `/api/vectorize/insert`.
- **Vectorize** `meauxide-rag`: 768-dim cosine; used by RAG and vectorize insert/query.
- **Secrets (encrypted):** `CURSOR_API_KEY` (optional). Future: Gemini key, OAuth client secrets.

---

## 2. GUI (MeauxIDE SPA)

**Single HTML app:** `meauxide/index.html` + `meaux-themes.css`. No separate framework; vanilla JS + hash routing.

### 2.1 Pages (views)

| Hash / Page | Purpose |
|-------------|---------|
| `#workspace` | Main “agent_sam” workspace: chat-style UI, MeauxSQL/D1 prompts, link to RAG/planning |
| `#dashboard` | D1 stats, My goal (Cadillac CTS-V), Run Cursor Agent quick-action |
| `#projects` | Kanban (Backlog / In progress / Done) + Featured projects |
| `#library` | D1-backed library (agent_commands) |
| `#workspaces` | Workspace list (inneranimalmedia-main, meauxide-default) — UI only for now |
| `#analytics` | Finance charts + add entry; Cursor connection (links, API key status, spend cap, **Run Cursor Agent** form); Cursor & AI spend (neurons charts, CSV import); Subscriptions |
| `#tools` | MeauxSQL, “More tools” (R2, Vectorize, Workers AI) |
| `#meauxmedia` | MeauxMedia section |

All data: `getApiBase()` → `https://meauxide.meauxbility.workers.dev` (or relative) → `/api/*`.

### 2.2 “Agent_sam” in the UI

- **RAG:** `/api/rag` uses system prompt “You are agent_sam, the MeauxIDE assistant.”
- **Seed D1:** `seed-agent-sam-ide-d1.sql` defines agent_sam IDE Assistant (config_json with system_prompt, tools, D1 binding). Projects/Library read from the same D1.
- **Workspace:** Buttons like “Ask agent_sam: grants & fundraising plan” / “Open agent_sam to run D1/SQL” open workspace and optionally prefill a prompt. Actual execution is via **Workers AI** (RAG or ai/generate) or **Cursor** (Run Cursor Agent), not a single “agent_sam” backend yet.

So today: **agent_sam** = branding + RAG system prompt + D1 config; execution = Workers AI (RAG/generate) or Cursor Cloud Agent.

---

## 3. CLI (ai-cli)

**Entry:** `index.js` (bin `ai`). **Purpose:** Chat with Workers AI from the terminal.

- **Auth:** `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` (optional).
- **Model:** `AI_MODEL` or `@cf/meta/llama-3.1-8b-instruct`.
- **Flow:** Calls **Cloudflare REST** `.../accounts/{id}/ai/run/{model}` directly. **Does not** call MeauxIDE; no D1, no RAG, no Cursor, no shared state.

So today: **CLI = standalone Workers AI**. To “get on the same page” as MeauxIDE, the CLI could later call MeauxIDE’s `/api/rag` or a dedicated “agent context” API instead of Workers AI directly.

---

## 4. Workers AI vs Cursor vs (Soon) Gemini

| System | Where it runs | How MeauxIDE uses it |
|--------|----------------|----------------------|
| **Workers AI** | Cloudflare Worker (embed + chat) | `/api/ai/generate`, `/api/rag`, `/api/vectorize/insert`; all logged to `ai_usage_log` |
| **Cursor** | Cursor’s infra (Cloud Agent API) | `/api/cursor/agent` (launch background agent on a GitHub repo); key in secret |
| **Gemini** | (Not yet) | Planned: same pattern as Cursor — key in secret, proxy endpoint, log to `ai_usage_log` with `provider=gemini_api` |

Goal: **one place** (MeauxIDE backend) that decides “use Workers AI vs Cursor vs Gemini” and records everything in D1 + analytics, so GUI/CLI/other agents all see the same state and spend.

---

## 5. How to Solidify: One Source of Truth, Zero Wasted AI Work

### 5.1 Single source of truth

- **D1:** Projects, library, finance, goals, **AI usage**, user settings. All agents (GUI, CLI, Cursor, future Gemini) should read/write through the same API so they don’t duplicate or contradict.
- **Vectorize:** RAG context. Seed once (docs, plans, project summaries); all entry points (GUI chat, CLI, Cursor “planning” tasks) query the same RAG so answers are consistent.
- **Plans / current task:** Add a small “agent context” store in D1 (e.g. `agent_plans` or `current_focus`) so that:
  - Cursor agent (or you on your phone) can write “current plan: X; next: Y.”
  - CLI or Workers AI RAG can read “what’s the current plan?” and avoid redoing finished work.

Concrete steps:

1. **D1 table (optional but recommended):** e.g. `agent_context` with `(key, value, updated_at)` — keys like `current_plan`, `current_task`, `last_cursor_agent_id`, `focus_repo`.
2. **API:** `GET/PUT /api/agent/context` or `GET/PUT /api/user/context` so any client (GUI, CLI, Cursor-triggered webhook) can read/update the same context.
3. **Seed Vectorize** with project summaries, MeauxIDE docs, and (if you want) high-level plans so RAG answers “what are we working on?” from one place.

### 5.2 One API surface for all “agents”

- **GUI:** Already uses MeauxIDE API only.
- **CLI:** Add a “MeauxIDE mode”: e.g. `ai --meauxide "what's the current plan?"` → call `GET /api/agent/context` + `POST /api/rag` with that context, print response. So CLI and GUI share RAG + context.
- **Cursor:** Already launches via MeauxIDE (`/api/cursor/agent`). Optionally: when Cursor task finishes (webhook), have MeauxIDE update `agent_context` (e.g. “last task: repo X, prompt Y, status done”) so the next agent (or you on phone) sees it.
- **Gemini (later):** Same idea: MeauxIDE endpoint that proxies to Gemini and logs to `ai_usage_log`; same `agent_context` so Gemini and Cursor and Workers AI stay aligned.

That way you’re not “rebuilding” — you’re **routing** every agent through one backend that holds state and logs.

### 5.3 OAuth and safety

- Today: `CURSOR_API_KEY` in Cloudflare secret; anyone with the MeauxIDE URL could use “Run Cursor Agent” if they knew the URL (no auth on the page). So: **OAuth later** to ensure only you (or your team) can trigger Cursor / spend.
- Same for Gemini: store key as secret; add OAuth so only authorized users can hit the Gemini proxy.
- Optional: simple API key or cookie auth for MeauxIDE so that even unauthenticated “Run Cursor Agent” is locked down until OAuth is in place.

### 5.4 Summary: what to build next (in order)

1. **Agent context in D1 + API** — `agent_context` (or `user_context`) table + `GET/PUT /api/agent/context` so GUI, CLI, and Cursor all read/write the same “current plan / task.”
2. **CLI MeauxIDE mode** — CLI flag to call MeauxIDE RAG + context instead of raw Workers AI, so terminal and browser stay on the same page.
3. **Seed Vectorize** with project summaries and priorities so RAG “what should I work on?” answers from one place.
4. **Cursor webhook (optional)** — When Cursor agent completes, POST to MeauxIDE to update `agent_context` (e.g. last task, repo, status).
5. **Gemini** — New secret + proxy endpoint + log to `ai_usage_log`; same context API.
6. **OAuth** — Protect Cursor/Gemini and optionally whole MeauxIDE so only you/your team can trigger agents and see spend.

---

## 6. Quick reference: “Where do I…”

| Goal | Where |
|------|--------|
| See backend health | `GET /api/health` |
| See projects / library | `GET /api/projects`, `GET /api/library` |
| Add finance / see spend | Analytics page or `GET/POST /api/analytics/finance` |
| See AI spend (Workers AI + Cursor import) | Analytics → Cursor & AI spend or `GET /api/analytics/neurons` |
| Run Cursor agent from phone | Dashboard → Open Run Agent, or Analytics → Run Cursor Agent |
| Chat with Workers AI (RAG) | Workspace (agent_sam) → uses `POST /api/rag` |
| Chat with Workers AI (raw) | `POST /api/ai/generate` |
| Use CLI | `npm run ai` or `ai "prompt"` (Workers AI only; no MeauxIDE yet) |
| Store/read “current plan” for all agents | (Not yet — use `agent_context` table + API above) |

This doc is the single overview for backend, GUI, CLI, Workers AI, Cursor, and the path to Gemini + OAuth with all agents on the same page and zero duplicated AI work.
