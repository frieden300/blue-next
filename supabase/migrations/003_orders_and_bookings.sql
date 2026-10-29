-- ============================================================
-- PROJECT BLUE — Migration 003: Orders, Rental & Experience Bookings
-- File: supabase/migrations/003_orders_and_bookings.sql
-- ============================================================

-- ── 1. orders ─────────────────────────────────────────────────
create table if not exists public.orders (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  status       text not null default 'confirmed'
                 check (status in ('confirmed','cancelled')),
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  note         text,
  created_at   timestamptz not null default now()
);

comment on table public.orders is
  'Confirmed gear cart orders. No payment processed — demo confirmation only.';

-- ── 2. order_items ────────────────────────────────────────────
create table if not exists public.order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  listing_id  uuid references public.listings(id) on delete cascade,
  title       text not null,
  unit_price  numeric(10, 2) not null check (unit_price >= 0),
  quantity    int  not null check (quantity >= 1 and quantity <= 50),
  image_url   text,
  created_at  timestamptz not null default now()
);

comment on table public.order_items is
  'Line items for each order. Price is snapshotted from listing at time of order.';

-- ── 3. rental_bookings ────────────────────────────────────────
create table if not exists public.rental_bookings (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  listing_id     uuid references public.listings(id) on delete cascade,
  listing_title  text not null,
  pickup_date    date not null,
  return_date    date not null,
  duration_days  int  not null check (duration_days >= 1),
  daily_rate     numeric(10, 2) not null check (daily_rate >= 0),
  rental_total   numeric(12, 2) not null check (rental_total >= 0),
  deposit_amount numeric(10, 2) not null default 0,
  status         text not null default 'confirmed'
                   check (status in ('confirmed','cancelled')),
  created_at     timestamptz not null default now(),
  constraint return_after_pickup check (return_date > pickup_date)
);

comment on table public.rental_bookings is
  'Rental reservations. No payment processed — demo confirmation only.';

-- ── 4. experience_bookings ────────────────────────────────────
create table if not exists public.experience_bookings (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  listing_id     uuid references public.listings(id) on delete cascade,
  listing_title  text not null,
  booking_date   date not null,
  guests         int  not null default 1 check (guests >= 1),
  unit_price     numeric(10, 2) not null check (unit_price >= 0),
  total_amount   numeric(12, 2) not null check (total_amount >= 0),
  status         text not null default 'confirmed'
                   check (status in ('confirmed','cancelled')),
  created_at     timestamptz not null default now()
);

comment on table public.experience_bookings is
  'Marine experience reservations. No payment processed — demo confirmation only.';

-- ── Ensure listing_id is nullable on existing tables (for static/demo items) ──
alter table public.order_items alter column listing_id drop not null;
alter table public.rental_bookings alter column listing_id drop not null;
alter table public.experience_bookings alter column listing_id drop not null;

-- ── Indexes ───────────────────────────────────────────────────
create index if not exists orders_user_idx              on public.orders(user_id);
create index if not exists order_items_order_idx        on public.order_items(order_id);
create index if not exists rental_bookings_user_idx     on public.rental_bookings(user_id);
create index if not exists experience_bookings_user_idx on public.experience_bookings(user_id);

-- ── Row Level Security ────────────────────────────────────────
alter table public.orders              enable row level security;
alter table public.order_items         enable row level security;
alter table public.rental_bookings     enable row level security;
alter table public.experience_bookings enable row level security;

-- ---- orders RLS ----
drop policy if exists "Users see own orders" on public.orders;
create policy "Users see own orders"
  on public.orders for select
  using (auth.uid() = user_id);

drop policy if exists "Users create own orders" on public.orders;
create policy "Users create own orders"
  on public.orders for insert
  with check (auth.uid() = user_id);

-- ---- order_items RLS ----
drop policy if exists "Users see own order items" on public.order_items;
create policy "Users see own order items"
  on public.order_items for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.user_id = auth.uid()
    )
  );

drop policy if exists "Users insert own order items" on public.order_items;
create policy "Users insert own order items"
  on public.order_items for insert
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and o.user_id = auth.uid()
    )
  );

-- ---- rental_bookings RLS ----
drop policy if exists "Users see own rental bookings" on public.rental_bookings;
create policy "Users see own rental bookings"
  on public.rental_bookings for select
  using (auth.uid() = user_id);

drop policy if exists "Users create own rental bookings" on public.rental_bookings;
create policy "Users create own rental bookings"
  on public.rental_bookings for insert
  with check (auth.uid() = user_id);

-- ---- experience_bookings RLS ----
drop policy if exists "Users see own experience bookings" on public.experience_bookings;
create policy "Users see own experience bookings"
  on public.experience_bookings for select
  using (auth.uid() = user_id);

drop policy if exists "Users create own experience bookings" on public.experience_bookings;
create policy "Users create own experience bookings"
  on public.experience_bookings for insert
  with check (auth.uid() = user_id);

-- ---- UPDATE policies for user cancellation ----
drop policy if exists "orders_update_own" on public.orders;
create policy "orders_update_own"
  on public.orders for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and status in ('confirmed', 'cancelled'));

drop policy if exists "rental_bookings_update_own" on public.rental_bookings;
create policy "rental_bookings_update_own"
  on public.rental_bookings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and status in ('confirmed', 'cancelled'));

drop policy if exists "experience_bookings_update_own" on public.experience_bookings;
create policy "experience_bookings_update_own"
  on public.experience_bookings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and status in ('confirmed', 'cancelled'));