# MeauxIDE scripts

## Import Cursor usage CSV

Imports Cursor usage export (CSV) into D1 `ai_usage_log` for Analytics.

**Prerequisites**

1. Apply migration 0003 (adds `account` column):
   ```bash
   cd meauxide && npx wrangler d1 migrations apply inneranimalmedia-business --remote
   ```

2. Deploy the worker so `/api/analytics/neurons/import` is available.

**Usage**

```bash
# From repo root
node meauxide/scripts/import-cursor-usage.js /path/to/meauxbility@gmail-usage-events-2026-02-03.csv

# Or with explicit account and base URL
MEAUX_ACCOUNT=meauxbility@gmail.com MEAUXIDE_URL=https://meauxide.meauxbility.workers.dev node meauxide/scripts/import-cursor-usage.js ~/Downloads/meauxbility@gmail-usage-events-2026-02-03.csv
```

**UI import**

In MeauxIDE → Analytics → “Import Cursor usage CSV”: choose file, set account (e.g. `meauxbility@gmail.com`), click Import.
