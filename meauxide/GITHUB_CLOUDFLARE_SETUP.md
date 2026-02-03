# GitHub + Cloudflare: What to Add and Why

You're on **GitHub repo settings** (`github.com/ceosamprimeaux/mcprimeaux/settings`). Here’s what you actually need.

---

## 1. Do you need a **GitHub secret** to connect Cloudflare?

**It depends how deploy runs.**

### If Cloudflare runs the deploy (Workers Builds / “Connect to Git”)

- You connected the repo in **Cloudflare dashboard** (Workers & Pages → your Worker → Settings → Builds → Git repository: `ceosamprimeaux/mcprimeaux`).
- Cloudflare uses **OAuth** to GitHub (you clicked “Connect to Git” and authorized). **No GitHub repository secret is required** for that connection or for Cloudflare to pull and deploy.
- You do **not** add `CLOUDFLARE_API_TOKEN` (or any Cloudflare token) as a **GitHub secret** in this setup. Cloudflare already has access via OAuth.

### If **GitHub Actions** runs the deploy

- Your repo would have `.github/workflows/*.yml` and the workflow runs `wrangler deploy` (or `npm run deploy`) on GitHub’s runners.
- Then **yes**: add **GitHub repository secrets** so the workflow can talk to Cloudflare:
  - `CLOUDFLARE_API_TOKEN` – Cloudflare API token with “Edit Cloudflare Workers” (and Pages if needed).
  - Optionally `CLOUDFLARE_ACCOUNT_ID` – your account ID (so the workflow doesn’t need to discover it).

**Summary:**  
- **Cloudflare Git integration (Builds):** no GitHub secret for “connecting” Cloudflare.  
- **GitHub Actions:** add `CLOUDFLARE_API_TOKEN` (and optionally `CLOUDFLARE_ACCOUNT_ID`) as **GitHub** secrets.

---

## 2. Do you need a **deploy key**?

**No**, for the way you’re set up.

- **Deploy key** = an SSH key you add in GitHub (Settings → Deploy keys) so another machine/service can **clone** the repo (e.g. a server or a CI that uses `git clone` over SSH).
- **Cloudflare Workers Builds** uses **OAuth** to access GitHub, not SSH and not a deploy key. So you don’t create a deploy key for Cloudflare’s built-in Git integration.
- You’d only add a deploy key if you had a **different** system (e.g. your own server or another CI) that needs to clone this repo via SSH.

---

## 3. Should you put **CURSOR_API_KEY** in GitHub secrets?

**No.**

- **CURSOR_API_KEY** is used by your **Worker at runtime** (when someone uses “Run Cursor Agent” in MeauxIDE). The Worker runs on **Cloudflare**, not on GitHub.
- Runtime secrets belong in **Cloudflare**: Workers & Pages → your Worker → **Settings → Variables and Secrets** (or `npx wrangler secret put CURSOR_API_KEY`). That’s where Cursor is “connected” for the app.
- **GitHub secrets** are only for **CI/CD** (e.g. scripts that run on push). They are not injected into your Worker. So putting `CURSOR_API_KEY` in GitHub would not connect Cursor to MeauxIDE and would only risk leaking the key into logs or misuse.
- **Rule:** Anything the **Worker** needs at runtime (Cursor, Gemini, OAuth, Images, etc.) → **Cloudflare** vars/secrets only. Nothing sensitive for runtime in GitHub.

---

## 4. Quick checklist (repo settings page)

On `https://github.com/ceosamprimeaux/mcprimeaux/settings`:

| Thing | Add in GitHub? | Where it’s actually used |
|-------|----------------|--------------------------|
| Cloudflare “connection” (OAuth) | No – done in Cloudflare dashboard when you connected the repo | Cloudflare pulls repo and runs deploy |
| `CLOUDFLARE_API_TOKEN` | Only if you use **GitHub Actions** to run `wrangler deploy` | Used by workflow to call Cloudflare API |
| Deploy key | No (for Cloudflare Git integration) | Not used by Cloudflare Builds |
| `CURSOR_API_KEY` | **No** | Worker runtime → set in **Cloudflare** Worker secrets only |
| GitHub PAT (if used in Actions) | In **GitHub** Actions secrets only, e.g. `GITHUB_TOKEN` or `MeauxIDE_GITHUB_PAT` | CI only; never in Cloudflare Worker or code. Revoke if exposed. |

---

## 6. GitHub PAT for CI/CD (if you use it)

- **Do not** put a GitHub PAT in the **Cloudflare Worker** dashboard (Variables and Secrets). Those are for runtime only; the Worker does not use a GitHub token.
- **If you add a GitHub PAT** (e.g. for GitHub Actions): GitHub repo → Settings → Secrets and variables → **Actions** → New repository secret. **Name:** e.g. `GITHUB_TOKEN` or `MeauxIDE_GITHUB_PAT`. **Value:** the PAT. Never in Cloudflare Worker or in code.
- **After adding:** Revoke any previously exposed token (GitHub → Settings → Developer settings → Personal access tokens) and create a new PAT if you still need one.

---

## 7. Why GitHub often causes “massive issues” and how to set it up cleanly

Common causes of pain:

1. **Two deploy paths** – Both Cloudflare Builds and GitHub Actions trying to deploy, or unclear which one is “real.” Pick one:
   - **Option A – Cloudflare only:** Connect repo in Cloudflare, no GitHub Actions. No GitHub secrets needed for deploy. Easiest.
   - **Option B – GitHub Actions only:** Don’t use Cloudflare “Connect to Git”; use a workflow that runs `wrangler deploy` and add `CLOUDFLARE_API_TOKEN` (and optionally `CLOUDFLARE_ACCOUNT_ID`) as GitHub secrets.

2. **Wrong root / wrong command** – Build runs from repo root but your Worker lives in a subfolder (e.g. `meauxide/`). Then `wrangler` can’t find `wrangler.jsonc` and deploy fails.
   - In Cloudflare Build settings set **Root directory** to the directory that contains `wrangler.jsonc` and `worker/index.ts` (e.g. `meauxide` if the repo root is above that).
   - **Build command:** leave empty or `npm run build` if you have a build step; **Deploy command:** e.g. `npx wrangler deploy` (or `npm run deploy` if that runs wrangler from the same root).

3. **Secrets in the wrong place** – Putting Worker runtime secrets (Cursor, Gemini, etc.) in GitHub doesn’t wire them to the Worker; they must be in Cloudflare. So: **only** Cloudflare for runtime; GitHub secrets **only** for CI (e.g. `CLOUDFLARE_API_TOKEN` when using Actions).

4. **Branch / production branch** – Cloudflare Builds often defaults to `main`. If your default branch is something else, set “Production branch” in Build configuration to match so pushes to that branch deploy.

**Optimal, minimal setup (Cloudflare Builds, no Actions):**

- **GitHub:** No new secrets; no deploy key. Just have the repo and branch you want (e.g. `main`).
- **Cloudflare (Workers & Pages → your Worker → Settings → Builds):**
  - Git repository: `ceosamprimeaux/mcprimeaux` (already connected via OAuth).
  - **Root directory:** `meauxide` (or whatever folder has `wrangler.jsonc` and `worker/index.ts`). Critical if repo root is not the Worker app.
  - **Production branch:** `main` (or your default).
  - **Build command:** empty (or `npm run build` if you add a build step).
  - **Deploy command:** `npx wrangler deploy` (or `npm run deploy` if that script runs wrangler from the same root).
- **Cloudflare Workers → Variables and Secrets:** Keep `CURSOR_API_KEY`, `GEMINI_API_KEY`, OAuth, Images, etc. here. Do **not** duplicate them into GitHub.

That way GitHub is only “where the code lives”; Cloudflare does the deploy and holds all runtime secrets. No Cursor key in GitHub; no deploy key needed; one clear deploy path so things don’t conflict.
