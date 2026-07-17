# Cradema — Cost-Minimized Deployment Guide

## Architecture

| Piece | Service | Plan | Cost |
|---|---|---|---|
| Frontend (React SPA) | **Vercel** | Hobby/Pro | $0 (Pro $20/mo if required — see note) |
| API (Express) | **Render** | Free or Starter | $0–7/mo |
| Database | **Neon** (Postgres) | Free | $0 |
| Images, PDFs, docs | **Cloudflare R2** | Free tier: 10 GB + zero egress | $0 |
| Course videos | **Bunny Stream** | Pay-as-you-go | ~$1–5/mo |
| Email | **Brevo** SMTP | Free: 300/day | $0 |

> **Vercel note:** the free Hobby plan is for non-commercial use. If Cradema sells
> courses, either use Vercel Pro ($20/mo) or deploy the frontend to
> **Cloudflare Pages** instead (free for commercial use, same static-hosting model —
> build command `npm run build`, output `dist`, add a SPA `_redirects` rule `/* /index.html 200`).

The backend automatically picks storage per file type:

- **Videos** → Bunny Stream (transcoded to adaptive HLS) → falls back to R2 → Cloudinary
- **Everything else** → R2 → falls back to Cloudinary
- Old Cloudinary URLs already in the database keep working untouched (they pass
  through `signCloudinaryUrl` as before) until you run the storage migration.

---

## 1. Database → Neon (do this first)

1. Create a free account at https://neon.tech and create a project
   (pick a region close to your users, e.g. Frankfurt/eu-central-1).
2. Copy the connection string, it looks like:
   `postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`
3. Copy your data from Render Postgres to Neon (run locally, needs `pg_dump`/`psql` from PostgreSQL client tools):

   ```sh
   pg_dump --no-owner --no-privileges "<RENDER_DATABASE_URL_EXTERNAL>" > cradema.sql
   psql "<NEON_DATABASE_URL>" < cradema.sql
   ```

   (Use the **External** connection string from the Render database page.)
4. In the Render dashboard → your web service → Environment: set
   `DATABASE_URL` to the Neon URL. The service restarts and now runs on Neon.
5. Verify the app works, then delete the Render Postgres instance so it stops
   billing / expiring.

## 2. File storage → Cloudflare R2

1. Create a free Cloudflare account → **R2 Object Storage** → Create bucket,
   name it e.g. `cradema` (location: automatic).
2. Bucket → **Settings → Public access**: enable the **r2.dev subdomain**
   (or connect a custom domain like `files.cradema.com` — better for caching).
   Note the public base URL, e.g. `https://pub-xxxxxxxx.r2.dev`.
3. Bucket → **Settings → CORS policy** — required for direct browser uploads:

   ```json
   [
     {
       "AllowedOrigins": ["https://cradema.com", "https://www.cradema.com", "https://your-app.vercel.app", "http://localhost:8080"],
       "AllowedMethods": ["GET", "PUT", "HEAD"],
       "AllowedHeaders": ["*"],
       "MaxAgeSeconds": 86400
     }
   ]
   ```

4. R2 overview page → **Manage R2 API Tokens** → Create API token with
   **Object Read & Write** on the bucket. Note the Access Key ID + Secret.
5. Set these env vars on Render:

   ```
   R2_ACCOUNT_ID=<Cloudflare account ID — shown on the R2 page>
   R2_ACCESS_KEY_ID=<token access key>
   R2_SECRET_ACCESS_KEY=<token secret>
   R2_BUCKET=cradema
   R2_PUBLIC_BASE_URL=https://pub-xxxxxxxx.r2.dev
   ```

## 3. Video hosting → Bunny Stream

1. Create an account at https://bunny.net → **Stream** → Add Video Library
   (name: `cradema`; replication regions: keep Europe, add Africa if offered).
2. Library → **API** → copy the API key.
3. Library → **Delivery** tab: note the CDN hostname, e.g. `vz-abc12345-678.b-cdn.net`.
4. (Recommended) Library → **Encoding**: enable **MP4 Fallback** so downloads
   and very old browsers work.
5. (Recommended, anti-piracy) Library → **Security**: enable
   "Block direct URL file access" later, once everything works; start without it.
6. Set these env vars on Render:

   ```
   BUNNY_LIBRARY_ID=<numeric library id>
   BUNNY_API_KEY=<library api key>
   BUNNY_CDN_HOST=vz-abc12345-678.b-cdn.net
   ```

> New video uploads take a few minutes to transcode before they play.
> The player streams them as adaptive HLS (auto quality switching on slow connections).

## 4. Frontend → Vercel

1. Push this repo to GitHub (the repo already contains `vercel.json`).
2. https://vercel.com → **Add New Project** → import the repo.
   Vercel auto-detects Vite; the root directory stays the repo root.
3. Set the environment variables (Project → Settings → Environment Variables):

   ```
   VITE_API_URL=https://elearn-canvas.onrender.com/api/v1
   VITE_GOOGLE_CLIENT_ID=<your Google OAuth client id>
   ```

   (Replace with your Render URL, or `https://api.cradema.com/api/v1` if you
   add a custom API subdomain on Render.)
4. Deploy. Then point your domain (`cradema.com`, `www.cradema.com`) at Vercel
   (Project → Settings → Domains) and remove it from Render.
5. Google OAuth: in Google Cloud Console, add the Vercel/production domain to
   **Authorized JavaScript origins**.

## 5. API → Render (now API-only)

1. The updated `render.yaml` no longer builds the frontend and no longer
   declares a managed database.
2. On the Render service, set/update the env vars listed in `render.yaml`
   (DATABASE_URL from Neon, R2_*, BUNNY_*, and:)

   ```
   CORS_ORIGIN=https://cradema.com,https://www.cradema.com,https://your-app.vercel.app
   FRONTEND_URL=https://cradema.com
   ```

3. Keep the `CLOUDINARY_*` vars **until** the storage migration (step 6) is done.
4. Plan choice: `free` (sleeps after 15 min → ~50 s cold start on first request)
   or Starter $7/mo (always on). Since Fapshi payment webhooks hit this service,
   Starter is recommended once you have real sales.

## 6. Migrate existing Cloudinary assets

Run from `backend/` with production env vars available (easiest: temporarily
put the production `DATABASE_URL`, `R2_*`, `BUNNY_*`, `CLOUDINARY_*` in
`backend/.env`, run, then remove them):

```sh
npm run migrate:storage:dry   # report what would be migrated
npm run migrate:storage       # download from Cloudinary, upload to R2/Bunny, rewrite DB URLs
```

- The script scans every table/column, so avatars, thumbnails, lesson videos,
  resources, attachments and submissions are all covered.
- Cloudinary assets are left in place as a safety net; failed items are listed
  and keep their old (still working) URLs.
- After verifying the app: remove the `CLOUDINARY_*` env vars from Render and
  close the Cloudinary account.

## 7. Verify

- [ ] Log in / register (API + Neon working)
- [ ] Load a course page — old thumbnails/avatars display (legacy URLs or migrated R2 URLs)
- [ ] As instructor: upload an **image** → network tab shows a `PUT` to `r2.cloudflarestorage.com`
- [ ] As instructor: upload a **video** → network tab shows TUS `PATCH`es to `video.bunnycdn.com`; after a few minutes it plays in the lesson player
- [ ] Download a lesson resource (PDF/doc)
- [ ] Make a test payment (Fapshi webhook reaches Render)
- [ ] `GET https://<render-url>/api/v1/test-email?to=you@example.com`

## Ongoing costs & limits to watch

| Service | Free limit | What happens after |
|---|---|---|
| Neon | 0.5 GB storage, autosuspend after inactivity | Launch plan $19/mo (you're far from needing it) |
| R2 | 10 GB storage, 1M writes/10M reads per month, **egress always free** | $0.015/GB/mo storage |
| Bunny Stream | none (pay-as-you-go) | ~$0.01/GB stored + ~$0.005/GB delivered, min ~$1/mo |
| Render free | sleeps after 15 min idle | Starter $7/mo, always-on |
| Brevo | 300 emails/day | paid tiers from ~$9/mo |
