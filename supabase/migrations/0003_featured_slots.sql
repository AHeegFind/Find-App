-- =============================================================================
-- FEATURED SLOTS — pay-only-if-selected Discover placement.
-- Workflow: admin reviews a product and offers it a slot (status='offered',
-- payment_deadline set) -> seller pays within the deadline (status='paid')
-- -> admin/system activates it for its date range (status='live') ->
-- automatically expires after end_date (status='expired'), freeing the
-- slot's position for the next offer. If the seller doesn't pay in time,
-- the offer lapses (status='lapsed') without ever going live.
--
-- Curation stays separate from payment: admin decides WHO gets offered a
-- slot; payment only decides whether an already-approved offer goes live.
-- =============================================================================

create table public.featured_slots (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references public.products(id) on delete cascade,
  discover_section text not null, -- e.g. 'editors-picks', 'nairobi-finds'
  position_tier text not null default 'standard' check (position_tier in ('top', 'standard')),
  price numeric(10,2) not null,
  currency text not null default 'KES',
  status text not null default 'offered'
    check (status in ('offered', 'paid', 'live', 'expired', 'lapsed', 'cancelled')),
  offered_at timestamptz not null default now(),
  payment_deadline timestamptz not null,
  paid_at timestamptz,
  start_date timestamptz,
  end_date timestamptz,
  duration_days int not null default 7,
  created_by uuid references public.users(id), -- admin who made the offer
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index featured_slots_status_idx on public.featured_slots(status);
create index featured_slots_section_idx on public.featured_slots(discover_section);
create index featured_slots_product_idx on public.featured_slots(product_id);

alter table public.featured_slots enable row level security;

-- Public can read only currently-live slots (this is what powers Discover's
-- featured shelf ordering) joined against already-public approved products.
create policy "public read live featured slots" on public.featured_slots for select
  using (status = 'live');

-- Seller (via product -> business ownership) can read their own slots at
-- any status, so they can see "you've been offered a slot" and pay for it.
create policy "owner reads own featured slots" on public.featured_slots for select
  using (exists (
    select 1 from public.products p join public.businesses b on b.id = p.business_id
    where p.id = product_id and b.owner_id = auth.uid()
  ));

create policy "admin manage featured slots" on public.featured_slots for all
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

create trigger featured_slots_set_updated_at before update on public.featured_slots
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Expiry function — run on a schedule (see README for cron setup) to flip
-- 'live' slots past their end_date to 'expired', and 'offered' slots past
-- their payment_deadline to 'lapsed'. Idempotent and safe to run often.
-- ---------------------------------------------------------------------------
create or replace function public.expire_featured_slots()
returns void language plpgsql as $$
begin
  update public.featured_slots
  set status = 'expired'
  where status = 'live' and end_date < now();

  update public.featured_slots
  set status = 'lapsed'
  where status = 'offered' and payment_deadline < now();
end;
$$;
