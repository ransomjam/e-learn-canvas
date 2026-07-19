# Cradema — Cut Storage Costs (Cloudinary → R2 + Bunny)

Your site is **already live** on Render (web service + database) using Cloudinary
for files and videos. Nothing here changes your database or takes the site down.

**Goal:** move files/images to **Cloudflare R2** and videos to **Bunny Stream**,
so you avoid Cloudinary's jump to **$99/month** as your videos grow. New setup
costs roughly **$0–5/month**.

**How the app decides (already coded, no action needed):**
- A **video** → uploaded to Bunny Stream. If Bunny isn't set, it uses Cloudinary.
- **Anything else** (images, PDFs, docs) → uploaded to R2. If R2 isn't set, Cloudinary.
- **Old Cloudinary links already saved keep working** until you migrate them (Part 6).

So you can set up R2 and Bunny at your own pace — the site never breaks.

> ⏱️ Plan ~45 minutes. You'll create 2 free accounts, copy 8 values into Render,
> deploy once, test, then move the old files across.

---

## Part 1 — Cloudflare R2 (files, images, PDFs)

1. Go to https://dash.cloudflare.com and sign up / log in (free).
2. Left menu → **R2 Object Storage**. If asked, add a payment card (R2's free
   tier is 10 GB with **no egress fees** — you won't be charged at your size).
3. Click **Create bucket**. Name it exactly **`cradema`**. Location: **Automatic**. Create.
4. Open the bucket → **Settings** tab:
   - Under **Public access** → **R2.dev subdomain** → click **Allow Access** / Enable.
     Copy the URL it shows, e.g. `https://pub-abc123.r2.dev` — this is your **R2_PUBLIC_BASE_URL**.
   - Scroll to **CORS policy** → **Add CORS policy** → paste this exactly, then Save:

     ```json
     [
       {
         "AllowedOrigins": [
           "https://cradema.com",
           "https://www.cradema.com",
           "http://localhost:8080"
         ],
         "AllowedMethods": ["GET", "PUT", "HEAD"],
         "AllowedHeaders": ["*"],
         "MaxAgeSeconds": 86400
       }
     ]
     ```
     *(CORS is required so the browser can upload directly to R2. Without it, uploads fail.)*
5. Get your API keys. Go back to the **R2 overview** page (left menu → R2):
   - On the right side, note your **Account ID** — this is **R2_ACCOUNT_ID**.
   - Click **Manage R2 API Tokens** → **Create API Token**.
     - Permissions: **Object Read & Write**.
     - Specify bucket: **Apply to specific buckets → cradema** (safer).
     - Create. It shows **Access Key ID** and **Secret Access Key** **once** — copy both now.
       These are **R2_ACCESS_KEY_ID** and **R2_SECRET_ACCESS_KEY**.

✅ After Part 1 you have 5 values:
`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` (=`cradema`), `R2_PUBLIC_BASE_URL`.

---

## Part 2 — Bunny Stream (videos)

1. Go to https://bunny.net and sign up (there's a small free credit; it's
   pay-as-you-go after, ~$0.01/GB stored + ~$0.005/GB watched).
2. Left menu → **Stream** → **Add Video Library**.
   - Name: `cradema`. Choose replication regions near your users (keep **Europe**,
     add **Africa** if offered). Create.
3. Open the library → **API** tab (or **Details**):
   - **Video Library ID** (a number) → this is **BUNNY_LIBRARY_ID**.
   - **API Key** → this is **BUNNY_API_KEY** (keep secret).
4. Find the **CDN Hostname** (same API/Details page, looks like
   `vz-1a2b3c4d-e56.b-cdn.net`) → this is **BUNNY_CDN_HOST**.
   Enter it **without** `https://` (just `vz-....b-cdn.net`).
5. Recommended: library → **Encoding** → enable **MP4 Fallback** (helps old devices/downloads).

✅ After Part 2 you have 3 values:
`BUNNY_LIBRARY_ID`, `BUNNY_API_KEY`, `BUNNY_CDN_HOST`.

---

## Part 3 — Add the 8 values to Render

1. https://dashboard.render.com → open the **`e-learn-canvas`** web service.
2. Left menu → **Environment**.
3. Click **Edit** (or **Add Environment Variable**) and add these 8 keys with the
   values you copied. **Keep your existing `CLOUDINARY_*` variables — don't delete them yet.**

   ```
   R2_ACCOUNT_ID          = <from Part 1>
   R2_ACCESS_KEY_ID       = <from Part 1>
   R2_SECRET_ACCESS_KEY   = <from Part 1>
   R2_BUCKET              = cradema
   R2_PUBLIC_BASE_URL     = https://pub-xxxxxxxx.r2.dev
   BUNNY_LIBRARY_ID       = <from Part 2>
   BUNNY_API_KEY          = <from Part 2>
   BUNNY_CDN_HOST         = vz-xxxxxxxx-xxx.b-cdn.net
   ```

4. **Save changes.** Render automatically redeploys (takes a few minutes).

---

## Part 4 — Deploy and test a new upload

1. Wait for the deploy to finish (green **Deployed**).
2. Open your site, log in as an instructor, and edit a course.
3. **Upload a new image or PDF** to a lesson. It should save and display normally.
4. **Upload a new video** to a lesson. It uploads, then takes a **few minutes to
   process** on Bunny before it plays (this is normal for adaptive streaming).
5. Optional proof it's using the new storage: open your browser's **DevTools →
   Network** while uploading:
   - Image/PDF → you'll see a request to `...r2.cloudflarestorage.com`.
   - Video → you'll see uploads to `video.bunnycdn.com`.

If uploads work, new content is now on R2 + Bunny. 🎉 Old content still loads from
Cloudinary — Part 6 moves it over.

---

## Part 5 — (Do this once) Verify with a dry run

This just **reports** what old Cloudinary files exist. It changes nothing.

1. In Render, open the **`e-learn-canvas`** web service → **Shell** tab.
2. Run:

   ```sh
   cd backend && npm run migrate:storage:dry
   ```

3. It prints every Cloudinary file it found and whether it would go to R2 or Bunny.
   Read the summary at the bottom. If it says *"No Cloudinary URLs found"* you're
   already fully migrated and can skip Part 6.

---

## Part 6 — Move your old Cloudinary files to R2 + Bunny

This downloads each old file from Cloudinary, re-uploads it to R2/Bunny, and
updates the links in your database. Old Cloudinary files are **left in place** as
a safety net (nothing is deleted).

1. Same **Shell** tab on the `e-learn-canvas` service. Run:

   ```sh
   cd backend && npm run migrate:storage
   ```

2. Let it finish. It prints `✏️ rewrote N row(s)` as it updates links, and a
   summary of successes / failures at the end.
3. Give Bunny a few minutes to finish transcoding the migrated videos, then
   browse your courses and check that thumbnails, images, PDFs and videos load.
4. If a few items failed, they simply keep their old (still-working) Cloudinary
   link — you can re-run the command later to retry them.

---

## Part 7 — Turn off Cloudinary (only after Part 6 looks good)

1. Browse the site thoroughly — old and new courses, images, downloads, videos.
2. When you're confident everything loads from R2/Bunny:
   - Render → `e-learn-canvas` → **Environment** → delete
     `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`. Save.
   - In Cloudflare R2, you can switch `R2_PUBLIC_BASE_URL` to a custom domain
     later (e.g. `files.cradema.com`) for nicer URLs — optional.
   - You can then downgrade or close your Cloudinary account.

Done — your storage bill is now R2 (free at your size) + Bunny (a few dollars),
instead of heading toward Cloudinary's $99/month.

---

## Optional, later — extra savings (not needed now)

You can ignore these until you want them. Your site is fine without them.

### A. Move the database to Neon (save ~$6/month)
Your database works today on Render's Basic-256mb plan. Neon's free tier could
replace it and save ~$6/month, but it's a live-data move with a little risk, so
only do it when you have time. When ready, ask and I'll walk you through the
`pg_dump` → Neon restore and the single `DATABASE_URL` change.
*(Tip: if you connect from your own PC, add `gssencmode=disable` / `sslmode=require`
to the connection string, and make sure the DB isn't Suspended.)*

### B. Move the frontend to Vercel (free, faster page loads)
Today Render serves both your website and API together, which works. Splitting
the website onto Vercel's global CDN makes pages load faster worldwide and takes
static traffic off Render. `vercel.json` is already in the repo. When ready:
import the repo on Vercel, set `VITE_API_URL=https://<your-render-url>/api/v1`
and `VITE_GOOGLE_CLIENT_ID`, deploy, then point cradema.com at Vercel and add the
domain to `CORS_ORIGIN` on Render.

---

## Quick reference — all environment variables

| Variable | Where it's from | Example |
|---|---|---|
| `R2_ACCOUNT_ID` | Cloudflare R2 overview | `a1b2c3...` |
| `R2_ACCESS_KEY_ID` | R2 API token | `f00ba7...` |
| `R2_SECRET_ACCESS_KEY` | R2 API token | `secret...` |
| `R2_BUCKET` | you chose it | `cradema` |
| `R2_PUBLIC_BASE_URL` | R2 bucket public URL | `https://pub-xxxx.r2.dev` |
| `BUNNY_LIBRARY_ID` | Bunny Stream library | `12345` |
| `BUNNY_API_KEY` | Bunny Stream library → API | `abcd-...` |
| `BUNNY_CDN_HOST` | Bunny Stream library | `vz-xxxx-xxx.b-cdn.net` |
