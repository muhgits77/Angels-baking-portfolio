# Angel's Baking Portfolio

A beautiful, warm, premium portfolio for a passionate baker. Built from a clean slate with zero Lovable remnants.

**Fully mobile-friendly** — Angel can comfortably upload new photos from her phone while on the go.

## Tech Stack
- Vite + React 19 + TypeScript
- Tailwind CSS (v4 via import)
- Supabase (table + public storage bucket + realtime)
- Framer Motion + Sonner (toasts) + Lucide icons

## Key Requirements Met
- Beautiful warm mouth-watering design focused on baked goods
- 100% Supabase — no localStorage data fallback ever
- Clean browser-only Supabase client (SSR-safe, works with TanStack Start etc.)
- Realtime updates via postgres_changes
- Studio: password-protected full CRUD (upload from camera/library, title, category, reorder via display_order, delete, featured toggle)
- Fully mobile-first — easy for Angel to manage photos from her phone
- Masonry gallery + category filters
- All sections: Hero, About, Signature Items, Gallery, Testimonials, Contact
- Production-ready for Vercel (only needs VITE_SUPABASE_* + VITE_STUDIO_PASSWORD)

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
VITE_SUPABASE_URL=https://nikppnqnwtwgwzfktzuu.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
VITE_STUDIO_PASSWORD=your-strong-studio-password
```

**Never commit real keys.**

### 3. Supabase Setup (one-time)

You are using this project: https://nikppnqnwtwgwzfktzuu.supabase.co

#### Table: public.bakes

The table should already exist with these columns:
- id (uuid, primary key)
- title (text)
- category (text)
- image_url (text)
- storage_path (text, nullable)
- display_order (integer)
- featured (boolean)
- created_at (timestamptz)

If needed, you can create it via SQL Editor:

```sql
create table if not exists public.bakes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  image_url text not null,
  storage_path text,
  display_order integer not null default 0,
  featured boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists bakes_display_order_idx on public.bakes (display_order, created_at);
```

#### Enable RLS + Policies (public read + write for this simple portfolio)

```sql
alter table public.bakes enable row level security;

-- Public can read (gallery is public)
create policy "Public read" on public.bakes for select using (true);

-- Anyone can insert (Studio uploads via anon key)
create policy "Public insert" on public.bakes for insert with check (true);

-- Anyone can update (title, category, order, featured)
create policy "Public update" on public.bakes for update using (true) with check (true);

-- Anyone can delete
create policy "Public delete" on public.bakes for delete using (true);
```

#### Storage Bucket: `bakes` (must be public)

1. Go to Storage in the Supabase dashboard.
2. Create a bucket named exactly **`bakes`**.
3. Make the bucket **Public**.
4. Add these policies under the bucket (Storage → Policies):

```sql
-- Public read
create policy "Public read" on storage.objects for select using (bucket_id = 'bakes');

-- Public upload
create policy "Public insert" on storage.objects for insert with check (bucket_id = 'bakes');

-- Public update (rarely needed)
create policy "Public update" on storage.objects for update using (bucket_id = 'bakes');

-- Public delete (for Studio remove)
create policy "Public delete" on storage.objects for delete using (bucket_id = 'bakes');
```

That's it. The Studio can now upload images and manage the bakes table.

### 4. Run locally
```bash
npm run dev
```

Open http://localhost:5173

Click **Studio** (top right) and enter the password from `VITE_STUDIO_PASSWORD`.

The app will connect directly to your Supabase project using the anon key. Realtime works out of the box in dev.

### 5. Deploy to Vercel
1. Push to GitHub.
2. Import the repo in Vercel.
3. Add these Environment Variables (Project Settings → Environment Variables):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_STUDIO_PASSWORD`
4. Deploy.

Vercel will run `npm run build`. No extra serverless functions are needed — the client talks directly to Supabase (same model as the previous working Supabase version).

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
- All changes are saved instantly to Supabase. Realtime keeps both the public gallery and Studio in sync.

---

## Environment Variables Reference

| Variable                  | Required | Description                                      |
|---------------------------|----------|--------------------------------------------------|
| VITE_SUPABASE_URL         | Yes      | Your Supabase project URL                        |
| VITE_SUPABASE_ANON_KEY    | Yes      | Public anon key (safe to expose in client)       |
| VITE_STUDIO_PASSWORD      | Yes      | Password to access the Studio admin (client)     |

---

## Architecture Notes (important)

- Supabase client is instantiated only in the browser via `getSupabase()` (see src/lib/supabase.ts).
- The `useBakes` hook performs the initial fetch + maintains a realtime subscription (`postgres_changes` on the bakes table).
- All mutations (upload via storage + table, update, delete, reorder) talk directly to Supabase.
- Realtime delivers INSERT/UPDATE/DELETE events to both the public gallery and the Studio.
- Reordering re-sequences `display_order` across the affected rows for reliability.
- **Zero** data is ever stored in localStorage. Supabase is the only source of truth.

---

## Troubleshooting

**"Missing Supabase configuration" or client errors**
→ Make sure `.env` contains valid `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Restart the dev server after editing `.env`.

**Uploads fail**
→ Check that the `bakes` storage bucket exists and is public, and that the RLS policies on both the table and storage allow insert for the anon role.

**Realtime not reflecting changes**
→ Check the browser console. The subscription uses the public anon key and requires the table policies to be correctly set.

**Studio password doesn't work**
→ Verify `VITE_STUDIO_PASSWORD` exactly matches what you type (including any special characters). The check is case-sensitive.

**Images 404 after delete**
→ Deletion removes the row and then attempts to remove the storage object by `storage_path`. If the path was somehow lost, the row will still be gone.

---

Built clean for Angel. No compromises.
