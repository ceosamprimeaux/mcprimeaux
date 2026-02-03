# Cloudflare Images + Stream — MeauxIDE

## CLOUDFLARE_IMAGES_API_TOKEN

MeauxIDE uses a **dedicated variable/secret** for Cloudflare media APIs. This token is used for: **image read/edit**, **stream read/edit**, and **account analytics**.

**Status:** Dedicated token created/installed with the permissions below.

- **Name:** `CLOUDFLARE_IMAGES_API_TOKEN`
- **Set via:** Cloudflare Dashboard → Workers & Pages → meauxide → Settings → Variables and Secrets, or:
  ```bash
  cd meauxide
  npx wrangler secret put CLOUDFLARE_IMAGES_API_TOKEN
  ```
- **Required token permissions:** Image read/edit, Stream read/edit, Account analytics.

Using a dedicated token keeps media access scoped and separate from other secrets (Cursor, Resend, etc.). Gallery and MeauxMedia (Cloudflare Images list/upload/delete) use this token; Stream and account analytics will use it when we add those features.

## Vars (wrangler.jsonc)

- **CLOUDFLARE_IMAGES_ACCOUNT_HASH** — `g7wf09fCONpnidkRnR_5vw` (for `imagedelivery.net` URLs).
- **CLOUDFLARE_ACCOUNT_ID** — Your account ID (for API host).

Secrets are encrypted; vars are in the config. The worker reads the token as `env.CLOUDFLARE_IMAGES_API_TOKEN`.
