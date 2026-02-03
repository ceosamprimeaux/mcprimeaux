# Cursor API + MeauxIDE

## 1. Create your Cursor User API key (for MeauxIDE / Agent Sam)

- **Dashboard:** [Cursor Dashboard → Integrations](https://cursor.com/dashboard?tab=integrations)
- Under **User API Keys**, enter a name (e.g. `CURSOR_API_KEY` or `MeauxIDE`) and click **Save**. Copy the key immediately; you won't see it again.

This key gives **programmatic access** to your Cursor account (headless Agent CLI and Cloud Agent API). A key created on your **Pro+** account uses your Pro+ quota and capabilities when MeauxIDE or Agent Sam call Cursor. Treat it like a password: keep it secret, never commit it. OAuth will be added later for safer, scoped access.

## 2. Export Cursor usage (CSV)

- **Dashboard:** [cursor.com/dashboard](https://cursor.com/dashboard) → **Billing** / **Usage** → export usage CSV.
- In MeauxIDE **Analytics** → **Cursor & AI spend** → **Import Cursor usage CSV** → choose file, set account (e.g. `meauxbility@gmail.com`), click **Import**.

## 3. Add Cursor API key to Wrangler

Store the User API key you created in step 1 as a secret so the worker can call Cursor (never in repo or client):

```bash
cd meauxide
npx wrangler secret put CURSOR_API_KEY
# Paste the key when prompted.
```

- Secret is encrypted; the worker sees it as `env.CURSOR_API_KEY`.
- Analytics **Cursor connection** card shows “API key: configured” when the secret is set.

## 4. Spend smart (strategic methods)

- **Set a hard limit in Cursor:** Settings → Usage → cap at e.g. $30–40/mo so overages are blocked.
- **Spend cap in MeauxIDE:** Analytics → **Cursor connection** → set “Spend cap (this period)” (e.g. $40) → **Save cap**. The UI warns when period spend exceeds this.
- **One Cursor Pro account** where possible to avoid double subscription + usage.
- **Prefer “Included” / non–On-Demand**; On-Demand and Opus/thinking models cost more.
- **Narrow context:** use `.cursorignore` and smaller folders so fewer tokens per request.
- **Use Composer sparingly** for huge edits; small, focused edits cost less.
- **Cache:** same files get cache reads (cheaper); avoid jumping between many unrelated repos in one session.

## 5. Full Cursor capabilities in MeauxIDE

- **Today:** CSV import, cost-by-day/provider/account charts, spend cap reminder, links to Cursor dashboard and API keys docs.
- **Next:** When Cursor exposes a usage/billing API, we’ll call it from the worker (using `CURSOR_API_KEY`) so usage can refresh automatically.
- **Later:** OAuth so only you can authorize MeauxIDE to use your Cursor; the key/secret will not be shared.
