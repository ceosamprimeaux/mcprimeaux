# MeauxMedia — CRUD Content Gallery / CMS Integration

MeauxMedia is the CRUD-capable content gallery and CMS at **/dashboard/meauxmedia**. It uses Cloudflare Images (imagedelivery.net) and R2 for storage.

## What It Does

- **Cloudflare Images**: List, upload (URL or file), delete. Paginated grid; uses your account’s Images API.
- **R2**: List (with optional prefix), upload file to a key, refresh. Uses the Worker’s R2 binding.

## Required Setup

### 1. Wrangler / Worker

In `wrangler.jsonc` (or `wrangler.toml`):

- **R2**: Already bound as `R2` (e.g. `inneranimalmedia-assets`). No extra config for MeauxMedia.
- **Cloudflare Images** (for list/upload/delete):
  - **Vars** (or env):
    - `CLOUDFLARE_IMAGES_ACCOUNT_HASH` — account hash used in imagedelivery.net URLs (e.g. `g7wf09fCONpnidkRnR_5vw`).
    - `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID (for API calls).
  - **Secret**:
    - `CLOUDFLARE_IMAGES_API_TOKEN` — API token with **Images: Edit** and **Account: Read** (or Images read/edit + Account analytics as in IMAGES_SETUP.md).

```bash
# Set the Images API token (secret)
npx wrangler secret put CLOUDFLARE_IMAGES_API_TOKEN
# Paste your token when prompted.
```

Vars are usually already in `wrangler.jsonc`:

```json
"vars": {
  "CLOUDFLARE_IMAGES_ACCOUNT_HASH": "g7wf09fCONpnidkRnR_5vw",
  "CLOUDFLARE_ACCOUNT_ID": "your-account-id"
}
```

### 2. Worker API Routes

The Worker must expose:

- **Images**
  - `GET /api/images` — list images (query: `page`, `perPage`).
  - `POST /api/images` — upload (JSON body with `url` for URL upload, or multipart for file upload; implementation may use Images API or R2).
  - `GET /api/images/:id` — get one image (e.g. metadata or redirect).
  - `DELETE /api/images/:id` — delete image (Images API).
- **R2**
  - `GET /api/r2` — list objects (query: `prefix`, `cursor`).
  - `PUT /api/r2/:key` — upload object (body = file bytes).

These are already implemented in `worker/index.ts` (Images and R2 handlers). Ensure `wrangler` has the same bindings and vars/secrets as above.

### 3. Frontend (MeauxIDE)

- **Route**: `/dashboard/meauxmedia` shows the MeauxMedia view (same as the gallery view; nav item “MeauxMedia”).
- **Title**: Page title is set to “MeauxMedia — Full CRUD Image Library” when opened from MeauxMedia.
- **Tabs**: “Cloudflare Images” and “R2 bucket” for the two backends.
- **CRUD**:
  - **Create**: Upload via URL or file (Images); upload file + key (R2).
  - **Read**: Paginated grid (Images); list + prefix (R2).
  - **Update**: Not implemented for Images (replace by delete + upload); R2 overwrite via PUT.
  - **Delete**: Delete button per image (Images); R2 delete can be added in the Worker if needed.

## Optional: R2 Custom Domain / Public Access

If you want direct image URLs from R2 (e.g. for a public CMS):

- Create an R2 custom domain or enable public access for the bucket.
- Use the same bucket (or a dedicated one) and keep the Worker’s R2 binding; the UI can still use `/api/r2` for list/upload.

## Checklist

- [ ] `CLOUDFLARE_IMAGES_ACCOUNT_HASH` and `CLOUDFLARE_ACCOUNT_ID` set in Wrangler (vars).
- [ ] `CLOUDFLARE_IMAGES_API_TOKEN` set via `npx wrangler secret put CLOUDFLARE_IMAGES_API_TOKEN`.
- [ ] R2 binding `R2` in Wrangler.
- [ ] Worker deployed with Images and R2 API routes.
- [ ] Open **/dashboard/meauxmedia** in MeauxIDE; “MeauxMedia” in the sidenav should show the CRUD gallery/CMS.

See **IMAGES_SETUP.md** for more detail on the Images token and permissions.
