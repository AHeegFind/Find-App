-- =============================================================================
-- FIND — Core database schema
-- Run via: supabase db push   (or paste into the Supabase SQL editor)
-- Requires the pgvector extension (enabled by default on Supabase projects)
-- =============================================================================

create extension if not exists vector;
create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- USERS
-- Supabase auth.users is the source of truth for login; this table holds
-- FIND-specific profile data, one row per authenticated user.
-- ---------------------------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'consumer' check (role in ('consumer', 'seller', 'admin')),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- CATEGORIES
-- Two-level taxonomy: top-level category + subcategory, matching the
-- Home / Fashion / Lifestyle / Beauty structure from the product brief.
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default uuid_generate_v4(),
  parent_id uuid references public.categories(id) on delete cascade,
  slug text not null unique,
  label text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- BUSINESSES (sellers, once approved)
-- ---------------------------------------------------------------------------
create table public.businesses (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  bio text,
  location text,
  logo_url text,
  whatsapp text,
  instagram text,
  tiktok text,
  website text,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'pending', 'verified', 'rejected', 'suspended')),
  verified_at timestamptz,
  verified_by uuid references public.users(id),
  suspension_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- SELLER_APPLICATIONS
-- The verification request a business submits; admin reviews and
-- approves/rejects. Kept separate from businesses so re-applications and
-- history are preserved even if a business record already exists.
-- ---------------------------------------------------------------------------
create table public.seller_applications (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  applicant_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  business_registration_notes text,
  supporting_links text[],
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- PRODUCTS
-- Core product record. sourceType distinguishes seller-submitted catalogue
-- items from web-indexed items (see product_images.source_url for indexed
-- provenance). Embeddings live on product_images (one per image) since a
-- product can have multiple photos with independent visual embeddings;
-- productsearch joins against the primary image's embedding.
-- ---------------------------------------------------------------------------
create table public.products (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references public.businesses(id) on delete cascade,
  category_id uuid references public.categories(id),
  name text not null,
  description text,
  price numeric(12,2) not null,
  currency text not null default 'KES',
  location text,
  dimensions text,
  material text,
  colour text,
  availability text not null default 'in_stock'
    check (availability in ('in_stock', 'customizable', 'sold_out')),
  source_type text not null default 'seller_submitted'
    check (source_type in ('seller_submitted', 'web_indexed')),
  source_website text,
  source_url text,
  verification_status text not null default 'found_online'
    check (verification_status in ('find_verified', 'found_online')),
  moderation_status text not null default 'pending'
    check (moderation_status in ('pending', 'approved', 'rejected')),
  moderated_by uuid references public.users(id),
  moderated_at timestamptz,
  featured boolean not null default false,
  discover_sections text[] default '{}',
  search_tags text[] default '{}',
  last_checked_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_category_idx on public.products(category_id);
create index products_business_idx on public.products(business_id);
create index products_moderation_idx on public.products(moderation_status);
create index products_tags_idx on public.products using gin(search_tags);

-- ---------------------------------------------------------------------------
-- PRODUCT_IMAGES
-- Each row is one image for a product. raw_image_url is the seller's
-- original upload; processed_image_url is the AI-generated polished
-- catalogue version. embedding is the CLIP-style vector for visual search.
-- ---------------------------------------------------------------------------
create table public.product_images (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references public.products(id) on delete cascade,
  raw_image_url text not null,
  processed_image_url text,
  is_primary boolean not null default false,
  approved boolean not null default false,
  embedding vector(512),
  vision_labels jsonb,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index product_images_product_idx on public.product_images(product_id);
-- ivfflat index for approximate nearest-neighbour search; requires rows to
-- exist before creation is efficient — safe to create up front on an empty
-- table, Postgres will just rebuild lists as data grows.
create index product_images_embedding_idx on public.product_images
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- ---------------------------------------------------------------------------
-- SEARCHES
-- Every search a user runs (image or text), logged for the admin
-- "no-result searches" view and for future ranking/analytics.
-- ---------------------------------------------------------------------------
create table public.searches (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete set null,
  query_type text not null check (query_type in ('image', 'text')),
  query_text text,
  query_image_url text,
  detected_tags text[],
  result_count int not null default 0,
  created_at timestamptz not null default now()
);

create index searches_user_idx on public.searches(user_id);
create index searches_created_idx on public.searches(created_at desc);

-- ---------------------------------------------------------------------------
-- SAVED_PRODUCTS
-- User favourites/saved items.
-- ---------------------------------------------------------------------------
create table public.saved_products (
  user_id uuid not null references public.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

-- ---------------------------------------------------------------------------
-- FIND_IT_REQUESTS
-- "Find it for me" — logged when a search returns no good match and the
-- user leaves contact details to be notified later.
-- ---------------------------------------------------------------------------
create table public.find_it_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete set null,
  name text,
  email text not null,
  whatsapp text,
  query_image_url text,
  detected_tags text[],
  item_type text,
  notes text,
  status text not null default 'open' check (status in ('open', 'matched', 'closed')),
  matched_product_id uuid references public.products(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- SUBSCRIPTIONS
-- Placeholder for future seller subscription tiers (not required for MVP
-- functionality but included per spec so billing can be added later
-- without a schema migration).
-- ---------------------------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro', 'enterprise')),
  status text not null default 'active' check (status in ('active', 'past_due', 'cancelled')),
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- AI_PROCESSING_JOBS
-- Tracks every async AI call (vision analysis, image generation, embedding)
-- so failures are visible and retriable from the admin dashboard.
-- ---------------------------------------------------------------------------
create table public.ai_processing_jobs (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid references public.products(id) on delete cascade,
  product_image_id uuid references public.product_images(id) on delete cascade,
  job_type text not null check (job_type in ('vision_analysis', 'image_generation', 'embedding', 'moderation')),
  provider text not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'succeeded', 'failed')),
  input jsonb,
  output jsonb,
  error_message text,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ai_jobs_status_idx on public.ai_processing_jobs(status);
create index ai_jobs_product_idx on public.ai_processing_jobs(product_id);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
alter table public.users enable row level security;
alter table public.businesses enable row level security;
alter table public.seller_applications enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.searches enable row level security;
alter table public.saved_products enable row level security;
alter table public.find_it_requests enable row level security;
alter table public.subscriptions enable row level security;
alter table public.ai_processing_jobs enable row level security;

-- users: can read/update their own row; admins can read all
create policy "users read own" on public.users for select using (auth.uid() = id);
create policy "users update own" on public.users for update using (auth.uid() = id);
create policy "admins read all users" on public.users for select
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

-- businesses: public read for verified/pending (so consumers see seller
-- pages); owner can read/update their own; admins full access
create policy "public read businesses" on public.businesses for select using (true);
create policy "owner manage business" on public.businesses for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "admin manage businesses" on public.businesses for all
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

-- seller_applications: applicant reads own; admin full access
create policy "applicant reads own application" on public.seller_applications for select
  using (auth.uid() = applicant_id);
create policy "applicant creates application" on public.seller_applications for insert
  with check (auth.uid() = applicant_id);
create policy "admin manage applications" on public.seller_applications for all
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

-- products: public read only for approved products; owner (via business)
-- can manage their own regardless of status; admin full access
create policy "public read approved products" on public.products for select
  using (moderation_status = 'approved');
create policy "owner reads own products" on public.products for select
  using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));
create policy "owner manages own products" on public.products for insert
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));
create policy "owner updates own products" on public.products for update
  using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));
create policy "admin manage products" on public.products for all
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

-- product_images: readable if parent product is approved, or owner/admin
create policy "public read images of approved products" on public.product_images for select
  using (exists (select 1 from public.products p where p.id = product_id and p.moderation_status = 'approved'));
create policy "owner manage own product images" on public.product_images for all
  using (exists (
    select 1 from public.products p join public.businesses b on b.id = p.business_id
    where p.id = product_id and b.owner_id = auth.uid()
  ));
create policy "admin manage product images" on public.product_images for all
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

-- searches: user can insert/read own (or anonymous insert allowed, user_id null)
create policy "insert own searches" on public.searches for insert with check (true);
create policy "read own searches" on public.searches for select using (auth.uid() = user_id);
create policy "admin read all searches" on public.searches for select
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

-- saved_products: fully owner-scoped
create policy "manage own saved products" on public.saved_products for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- find_it_requests: anyone can insert (including anonymous with email only);
-- admin reads all; user reads own if logged in
create policy "insert find requests" on public.find_it_requests for insert with check (true);
create policy "read own find requests" on public.find_it_requests for select using (auth.uid() = user_id);
create policy "admin manage find requests" on public.find_it_requests for all
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

-- subscriptions: owner + admin only
create policy "owner reads own subscription" on public.subscriptions for select
  using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));
create policy "admin manage subscriptions" on public.subscriptions for all
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

-- ai_processing_jobs: owner of related product + admin
create policy "owner reads own ai jobs" on public.ai_processing_jobs for select
  using (exists (
    select 1 from public.products p join public.businesses b on b.id = p.business_id
    where p.id = product_id and b.owner_id = auth.uid()
  ));
create policy "admin manage ai jobs" on public.ai_processing_jobs for all
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Vector similarity search RPC — called from the search API route.
-- Returns product rows ranked by cosine distance on their primary image
-- embedding, joined with business info, filtered to approved products.
create or replace function public.match_products(
  query_embedding vector(512),
  match_threshold float default 0.5,
  match_count int default 20
)
returns table (
  product_id uuid,
  similarity float
)
language sql stable
as $$
  select
    pi.product_id,
    1 - (pi.embedding <=> query_embedding) as similarity
  from public.product_images pi
  join public.products p on p.id = pi.product_id
  where pi.is_primary = true
    and p.moderation_status = 'approved'
    and pi.embedding is not null
    and 1 - (pi.embedding <=> query_embedding) > match_threshold
  order by pi.embedding <=> query_embedding
  limit match_count;
$$;

-- Auto-update updated_at columns
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_set_updated_at before update on public.users
  for each row execute function public.set_updated_at();
create trigger businesses_set_updated_at before update on public.businesses
  for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products
  for each row execute function public.set_updated_at();
create trigger ai_jobs_set_updated_at before update on public.ai_processing_jobs
  for each row execute function public.set_updated_at();

-- Auto-create a public.users row when someone signs up via Supabase Auth
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
