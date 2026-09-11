# Find — real application

This is a working Next.js + Supabase application, not a mockup. Every page
calls real Supabase queries and real API routes; the AI service layer calls
real providers when keys are configured, and falls back to a clearly-logged
mock when they aren't, so the app runs end-to-end either way.

## 1. Install dependencies

```
npm install
```

## 2. Create a Supabase project

At https://supabase.com/dashboard — free tier is fine to start.

## 3. Run the database migrations

In the Supabase dashboard, go to SQL Editor, and run the contents of, in order:
1. `supabase/migrations/0001_init.sql` (schema, RLS policies, functions)
2. `supabase/migrations/0002_seed_categories.sql` (category taxonomy — Home and Fashion only)
3. `supabase/migrations/0003_featured_slots.sql` (paid Discover placement system)
4. `supabase/migrations/0004_sponsored_and_analytics.sql` (sponsored search results, promoted placements, seller view/analytics tracking)

(Or, if you have the Supabase CLI installed locally: `supabase db push`.)

## 4. Create two Storage buckets

Storage buckets aren't part of the SQL schema — create them in the Supabase
dashboard under Storage:
- `product-images` — public bucket, for seller-uploaded product photos
- `search-queries` — public bucket, for consumer photo-search uploads

Both need public read access so the AI vision APIs (which need a fetchable
URL) and the browser can load the images.

## 5. Set environment variables

```
cp .env.example .env.local
```

Fill in:
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`
  — from Supabase dashboard → Settings → API. **Required** — nothing works without these.
- `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` — powers real photo analysis (VisionAnalysisService).
  Without either, uploads still work but get a mock analysis (clearly labeled in server logs).
- `OPENAI_API_KEY` — also powers text embeddings and content moderation.
- `REPLICATE_API_TOKEN` — powers image embeddings for visual similarity search.
  Without it, visual search falls back to tag-overlap matching only.
- `PHOTOROOM_API_KEY` — powers catalogue image polish (background removal +
  AI relighting + AI soft shadow). Requires a **Plus-tier** Photoroom API
  plan, not Basic (Basic only does plain background removal). Without it,
  the seller's raw photo is used unmodified.

## 6. Create your first admin user

Sign up normally through the app (`/auth/signup`), then in the Supabase
SQL Editor run:

```sql
update public.users set role = 'admin' where email = 'you@example.com';
```

## 7. Run it

```
npm run dev
```

Visit `http://localhost:3000/find`.

## What's real vs. what needs your keys

| Feature | Works with just Supabase | Needs AI keys too |
|---|---|---|
| Auth, saved products, search history | Yes | — |
| Seller signup, product upload, admin approval | Yes | — |
| Text/tag-based search matching | Yes | — |
| Real photo understanding (vision analysis) | Mocked (logged) | Yes — ANTHROPIC_API_KEY or OPENAI_API_KEY |
| Real visual similarity search (embeddings) | Mocked (logged) | Yes — OPENAI_API_KEY + REPLICATE_API_TOKEN |
| Polished catalogue image generation | Skipped (uses raw photo) | Yes — PHOTOROOM_API_KEY (Plus tier) |
| Image content moderation | Auto-approved (logged) | Yes — OPENAI_API_KEY |

Every mock is logged clearly server-side (`console.warn`) so it's never
silently mistaken for a real result — check your terminal when testing.

## Architecture notes

- **AI services** (`lib/services/*.ts`) are all interface-based — see
  `lib/services/types.ts`. Swapping providers means writing one new class and
  changing the factory function (`getVisionService()`, etc.) — no call sites change.
- **Database schema** (`supabase/migrations/0001_init.sql`) includes Row Level
  Security policies for every table — consumers only ever see approved
  products; sellers only see/edit their own; admins bypass via the service-role
  client in trusted server routes.
- **AI processing pipeline**: seller upload → 3 queued `ai_processing_jobs`
  rows (vision_analysis, image_generation, embedding) → each processed by
  `/api/ai/process-job` → failures are visible and retriable from
  `/admin` → Jobs tab.
- **Web-indexed products**: the schema (`source_type`, `source_website`,
  `source_url`, `last_checked_at` on `products`) supports products ingested
  from permitted external sites, but no crawler is implemented — that's
  intentionally left as a separate, deliberate build (see prior conversation
  about legal/ToS constraints on automated indexing). Populate these fields
  manually or build a scheduled job against specific approved sources.
- **Featured slots (paid Discover placement)**: workflow is
  admin offers a slot on an already-approved product (`/admin` → Featured
  tab) → seller sees the offer on `/seller/dashboard` and pays within 48
  hours → slot goes live and sorts to the top of its Discover shelf for its
  duration (default 7 days) → automatically expires and frees the slot.
  Curation and payment are deliberately separate: only products an admin
  has already approved can ever be offered a slot, so paying can never
  buy placement for something that wasn't editorially chosen.

  **Payment is not yet wired to a real processor.** `/api/seller/featured-slots/[id]/pay`
  currently marks a slot paid the moment it's called — there's no real
  M-Pesa charge happening. Real collection needs Safaricom's Daraja API
  (STK Push), which requires its own developer registration and is a
  separate integration from this build. Until then, the realistic flow is:
  seller pays you directly (till number/paybill), you or an admin confirms
  it happened, and you call this same endpoint manually (or a "confirm
  payment" button, easy to add) to activate the slot.

  **Cron setup**: `vercel.json` schedules `/api/cron/expire-slots` every 30
  minutes once deployed to Vercel — this activates paid slots whose start
  date has arrived and expires ones past their end date. Set a
  `CRON_SECRET` env var (any random string) so this endpoint can't be
  triggered by outsiders; Vercel sends it automatically when cron is configured.

- **Sponsored search results**: same offer/pay/expire machinery as featured
  slots, extended with a `placement_type` field. Admin offers a
  `search_keyword` or `search_visual` slot with a list of keywords (e.g.
  "sofa, white sofa") instead of a Discover section. Once paid and live,
  that product is pinned to the top of matching search results, clearly
  labelled "Sponsored" — never mixed in undisclosed with organic matches,
  and never counted toward the "no results found" logic, so a sponsored
  hit can't mask a real inventory gap.
- **Seller analytics** (`/seller/analytics`): plain counting and grouping
  of already-logged events (`product_views`, `saved_products`, `searches`)
  — no AI involved, none needed. Shows total views/saves over 30 days,
  per-product breakdown with a "Top" product highlight, and which search
  terms led people toward their products. Views are logged automatically
  whenever a product detail page loads (`/api/products/track-view`).
# Find-App
