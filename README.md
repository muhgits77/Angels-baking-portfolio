# Angel's Baking Portfolio

A beautiful, warm, premium portfolio for a passionate baker. Built from a clean slate with zero Lovable remnants.

**Fully mobile-friendly** — Angel can comfortably upload new photos from her phone while on the go.

## Tech Stack
- Vite + React 19 + TypeScript
- Tailwind CSS (v4 via import)
- Vercel Blob (for images + JSON manifest)
- Framer Motion + Sonner (toasts) + Lucide icons

## Key Requirements Met
- Beautiful warm mouth-watering design focused on baked goods (unchanged)
- All images + metadata stored via Vercel Blob only
- No localStorage data fallback whatsoever
- Studio: password-protected full CRUD (upload, title, categorize, reorder, delete, featured toggle)
- Simple & reliable — works great over VPNs and on mobile
- Masonry gallery + category filters
- All requested sections: Hero, About, Signature Items, Gallery, Testimonials, Contact
- Production-ready for Vercel (only needs two env vars)

---

## Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment

Copy the example and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:
```env
VERCEL_BLOB_READ_WRITE_TOKEN=your_blob_rw_token_here
VITE_STUDIO_PASSWORD=your-strong-studio-password
```

**Never commit real keys.** The blob token must stay server-only (no `VITE_` prefix).

### 3. Set up Vercel Blob (one-time)

1. Go to your project on Vercel → **Storage** tab.
2. Click **Create Blob Store** (or "Connect Blob").
3. Choose a name (e.g. `angels-baking`).
4. After creation, go to the store → copy the **READ_WRITE_TOKEN**.
5. Paste it into `VERCEL_BLOB_READ_WRITE_TOKEN` in your Vercel project Environment Variables **and** in your local `.env`.

That's all the "database" you need. Images and a small `manifest/bakes.json` file will be created automatically on first upload.

No tables, no RLS, no policies to manage. Much simpler.

### 4. Run locally

For viewing the public site (gallery):
```bash
npm run dev
```

For full Studio functionality (uploads, deletes, etc.) during development you need the API routes:

```bash
# Recommended for testing the Studio
npx vercel dev
```

Then open http://localhost:3000 (or the port vercel dev uses).

Click **Studio** and enter the password from `VITE_STUDIO_PASSWORD`.

> Note: Plain `npm run dev` will show the gallery fine (it will just get an empty list until you deploy or use `vercel dev` with a valid token).

### 5. Deploy to Vercel
1. Push your code to GitHub.
2. Import the repository in Vercel.
3. In **Project Settings → Environment Variables**, add:
   - `VERCEL_BLOB_READ_WRITE_TOKEN` (the read/write token — **not** prefixed with VITE_)
   - `VITE_STUDIO_PASSWORD`
4. Redeploy.

Vercel automatically runs `npm run build`. The `/api` folder becomes serverless functions that securely talk to Blob.

---

## How the "Database" Works Now (for the curious)

- All photos → stored as public objects in your Vercel Blob store.
- All metadata (titles, order, categories, featured flags) → stored in one small public JSON file: `manifest/bakes.json` inside the same Blob store.
- The Studio talks to two tiny API routes (`/api/upload` and `/api/bakes`) that run on Vercel. These routes are the only place that uses the RW token.
- The public gallery just fetches `/api/bakes` (or the manifest directly) on load. No realtime needed — changes are visible after refresh or after Angel saves in the Studio.

This is dramatically simpler than a traditional database setup while being very reliable for a single-author portfolio.

---

## Studio Usage (for Angel)

- Tap **Studio** on mobile or desktop
- Enter the password once per session
- **Add New Bake**: Tap the big dropzone → pick photo from camera or library → give it a nice title → choose category → optionally mark as "Featured" → Publish
- **Edit**: Tap any title in the list to rename inline
- **Change category**: Tap the small category pills under each item
- **Reorder**: Use the up/down arrows (big touch targets)
- **Feature / Unfeature**: Star icon adds or removes from the Signature Items section
- **Delete**: Trash icon (with confirmation)
- All changes are saved to Vercel Blob. Refresh the public site (or wait for cache) to see updates. The Studio itself refetches after every action.

---

## Environment Variables Reference

| Variable                        | Required | Description                                      |
|---------------------------------|----------|--------------------------------------------------|
| VERCEL_BLOB_READ_WRITE_TOKEN    | Yes      | Vercel Blob RW token (server only, no VITE_ prefix) |
| VITE_STUDIO_PASSWORD            | Yes      | Password to access the Studio admin (client)     |

---

## Architecture Notes (important)

- No Supabase at all.
- Image blobs and the `manifest/bakes.json` live in your Vercel Blob store.
- Client never sees `VERCEL_BLOB_READ_WRITE_TOKEN`.
- `useBakes` simply fetches `/api/bakes` (the server reads the manifest).
- After every Studio action we persist the full list + (when deleting) the pathname(s) to remove.
- Reordering always re-sequences `display_order` 0..N for maximum reliability.
- **Zero** data in localStorage.

---

## Troubleshooting

**Uploads / Studio actions fail with "token not configured"**
→ Make sure `VERCEL_BLOB_READ_WRITE_TOKEN` is set in Vercel Environment Variables (and in `.env` when using `vercel dev`). Do **not** prefix it with `VITE_`.

**Gallery is empty even after uploading**
→ Use `vercel dev` locally or deploy. Plain `vite` dev server does not run the `/api` functions.

**Images don't appear or 404 after delete**
→ The manifest and the actual image blobs are separate. Deleting always removes both the manifest entry and the blob via its `pathname`.

**Studio password doesn't work**
→ Verify `VITE_STUDIO_PASSWORD` matches exactly (case sensitive, no extra spaces).

---

Built clean for Angel. No compromises.
