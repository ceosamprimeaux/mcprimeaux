# MeauxIDE Worker

Worker stack: **R2** (stored), **D1** (db), **Workers AI**, **Vectorize**, **AutoRAG**.

## Bindings (wrangler.jsonc)

- **ASSETS** – static files (index.html, meaux-themes.css, etc.)
- **DB** – D1 (inneranimalmedia-business)
- **R2** – R2 bucket (inneranimalmedia-assets)
- **AI** – Workers AI
- **VECTORIZE** – Vectorize index `meauxide-rag`

## Create Vectorize index

Embeddings use `@cf/baai/bge-base-en-v1.5` (768 dimensions). Create the index once:

```bash
cd meauxide
npx wrangler vectorize create meauxide-rag --dimensions=768 --metric=cosine
```

Then ensure `index_name` in `wrangler.jsonc` matches (`meauxide-rag`).

## Deploy

From `meauxide/`:

```bash
npx wrangler deploy
```

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | D1 connectivity |
| `/api/dashboard` | GET | D1 dashboard stats |
| `/api/projects` | GET | D1 agent_configs list |
| `/api/library` | GET | D1 agent_commands list |
| `/api/r2/<key>` | GET | R2 get object; GET no key = list |
| `/api/r2/<key>` | PUT | R2 put object |
| `/api/r2/<key>` | DELETE | R2 delete |
| `/api/ai/generate` | POST | Workers AI chat `{ "prompt", "system?" }` |
| `/api/vectorize/insert` | POST | Embed text and upsert `{ "id?", "text", "metadata?" }` |
| `/api/vectorize/query` | POST | Query by vector `{ "vector", "topK?" }` |
| `/api/rag` | POST | AutoRAG: embed question, Vectorize search, AI with context `{ "question", "topK?" }` |
| `/api/analytics/finance` | GET | Finance entries from D1 (query param `?days=30`). Returns `summary`, `byMonth`, `byCategory`, `rows`. |
| `/api/analytics/finance` | POST | Insert finance entry `{ "date", "amount", "category", "description?" }`. |
| `/api/analytics/neurons` | GET | AI/API usage (neuron) from D1 (query param `?days=30`). Returns `summary`, `byDay`, `byProvider`, `rows`. |

## Analytics (finance + AI spend)

Run the analytics migration **once** on your D1 database so the Analytics UI and APIs can store/read data. Safe to re-run (uses `CREATE TABLE IF NOT EXISTS`).

```bash
cd meauxide
npx wrangler d1 execute inneranimalmedia-business --remote --file=./migrations/0001_analytics_tables.sql
```

Database ID: `inneranimalmedia-business` (see `wrangler.jsonc`). For local dev, omit `--remote`.

- **Finance**: Add entries via `POST /api/analytics/finance` or insert into `finance_entries` in D1. The UI shows totals, by month (bar), and by category (doughnut).
- **Neurons**: Every `/api/rag` and `/api/ai/generate` call is logged to `ai_usage_log` (provider, tokens, cost estimate). The UI shows cost by day (line) and by provider (bar).

## AutoRAG flow

1. Embed the question with Workers AI (`bge-base-en-v1.5`).
2. Query Vectorize for top‑K similar vectors (metadata `text` used as context).
3. Run Workers AI chat with that context + question; return the answer plus `retrieved` and `ids`.
