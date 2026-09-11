-- =============================================================================
-- SPONSORED PLACEMENTS — extends the pay-only-if-selected model from
-- Discover featuring to two more surfaces:
--   'search_keyword'  -> sponsored result pinned to top when a user's
--                        detected search tags match given keywords
--                        (e.g. seller buys "sofa", "white sofa")
--   'search_visual'   -> sponsored result surfaced in visual/photo search
--                        results for products tagged with matching
--                        search_tags (reuses products.search_tags)
-- Same admin-approves-then-seller-pays workflow as featured_slots, and
-- literally reuses that table rather than duplicating the offer/pay/expire
-- machinery — placement_type + keywords are the only new fields needed.
-- =============================================================================

alter table public.featured_slots
  add column placement_type text not null default 'discover'
    check (placement_type in ('discover', 'search_keyword', 'search_visual', 'promoted')),
  add column keywords text[] default '{}'; -- used by search_keyword/search_visual placements

-- discover_section becomes optional now that not every slot is a Discover
-- shelf placement (a search_keyword slot has keywords instead).
alter table public.featured_slots alter column discover_section drop not null;

comment on column public.featured_slots.placement_type is
  'discover: Discover shelf placement (original behaviour). search_keyword: pinned to top of text-search results matching keywords. search_visual: pinned to top of photo-search results whose detected tags overlap keywords. promoted: shown as a promoted card on the product''s own category/browse page.';
comment on column public.featured_slots.keywords is
  'For search_keyword/search_visual placements: the tags/terms this slot should surface for. Ignored for discover/promoted placements.';

-- =============================================================================
-- ANALYTICS — lightweight event log for seller-facing analytics. Plain
-- counting/grouping, no AI involved. product_views logs every time a
-- product card or detail page is rendered to a user; the existing
-- `searches` table already covers search-term analytics, and
-- `saved_products` already covers save counts, so this table only needs
-- to add the missing piece: views.
-- =============================================================================
create table public.product_views (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  source text not null default 'browse' check (source in ('browse', 'discover', 'search_image', 'search_text')),
  created_at timestamptz not null default now()
);

create index product_views_product_idx on public.product_views(product_id);
create index product_views_created_idx on public.product_views(created_at desc);

alter table public.product_views enable row level security;

create policy "insert product views" on public.product_views for insert with check (true);

create policy "owner reads own product views" on public.product_views for select
  using (exists (
    select 1 from public.products p join public.businesses b on b.id = p.business_id
    where p.id = product_id and b.owner_id = auth.uid()
  ));

create policy "admin reads all product views" on public.product_views for select
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));
