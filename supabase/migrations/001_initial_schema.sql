-- ============================================================
-- PROJECT BLUE — Initial Database Schema
-- File: supabase/migrations/001_initial_schema.sql
-- Migration 001: Core tables, RLS policies, indexes & storage
-- ============================================================

-- ── 1. profiles ──────────────────────────────────────────────
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.profiles is
  'Public-facing user profile. Linked 1-to-1 with auth.users.';

-- ── 2. user_roles ────────────────────────────────────────────
create table if not exists public.user_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('customer', 'partner', 'admin')),
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id),
  unique (user_id, role)
);

comment on table public.user_roles is
  'Privileged role assignments. Only modified by trusted server functions or admin SQL.';

-- ── 3. partner_applications ──────────────────────────────────
create table if not exists public.partner_applications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  business_name   text not null,
  contact_email   text not null,
  location        text,
  description     text not null,
  services        text[],          -- e.g. {"experience","sell","rent"}
  status          text not null default 'pending'
                    check (status in ('pending','approved','rejected')),
  reviewer_id     uuid references auth.users(id),
  reviewer_note   text,
  submitted_at    timestamptz not null default now(),
  reviewed_at     timestamptz
);

comment on table public.partner_applications is
  'Applications to become a marketplace partner. Status set only by admins.';

-- ── 4. partner_profiles ──────────────────────────────────────
create table if not exists public.partner_profiles (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null unique references auth.users(id) on delete cascade,
  business_name text not null,
  description   text,
  location      text,
  logo_url      text,
  verified      boolean not null default false,
  created_at    timestamptz not null default now()
);

comment on table public.partner_profiles is
  'Profile for approved partner/operator accounts.';

-- ── 5. listings ──────────────────────────────────────────────
create table if not exists public.listings (
  id             uuid primary key default gen_random_uuid(),
  partner_id     uuid not null references public.partner_profiles(id) on delete cascade,
  category       text not null
                   check (category in ('experience','diving','snorkeling','boat_tour','guided','rental','gear')),
  subcategory    text,
  title          text not null,
  description    text,
  location       text,
  price_from     numeric(10, 2) not null check (price_from >= 0),
  duration_hours numeric(5, 2),
  difficulty     text check (difficulty in ('beginner','intermediate','advanced')),
  status         text not null default 'draft'
                   check (status in ('draft','active','paused','archived')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.listings is
  'Core listing entity for experiences, gear, and rentals.';

-- ── 6. listing_images ───────────────────────────────────────
create table if not exists public.listing_images (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references public.listings(id) on delete cascade,
  url         text not null,
  alt_text    text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

-- ── Indexes ──────────────────────────────────────────────────
create index if not exists listings_status_idx         on public.listings(status);
create index if not exists listings_category_idx       on public.listings(category);
create index if not exists listings_partner_idx        on public.listings(partner_id);
create index if not exists listing_images_listing_idx  on public.listing_images(listing_id);
create index if not exists applications_user_idx       on public.partner_applications(user_id);
create index if not exists applications_status_idx     on public.partner_applications(status);
create index if not exists user_roles_user_idx         on public.user_roles(user_id);

-- ── Row Level Security ───────────────────────────────────────
alter table public.profiles             enable row level security;
alter table public.user_roles           enable row level security;
alter table public.partner_applications enable row level security;
alter table public.partner_profiles     enable row level security;
alter table public.listings             enable row level security;
alter table public.listing_images       enable row level security;

-- ---- profiles RLS ----
drop policy if exists "Public profiles are readable" on public.profiles;
create policy "Public profiles are readable"
  on public.profiles for select using (true);

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---- partner_applications RLS ----
drop policy if exists "Applicants see own application" on public.partner_applications;
create policy "Applicants see own application"
  on public.partner_applications for select
  using (auth.uid() = user_id);

drop policy if exists "Authenticated users can apply" on public.partner_applications;
create policy "Authenticated users can apply"
  on public.partner_applications for insert
  with check (
    auth.uid() = user_id
    and status = 'pending'
    and reviewer_id is null
    and reviewer_note is null
  );

drop policy if exists "Applicants can update own pending application" on public.partner_applications;
create policy "Applicants can update own pending application"
  on public.partner_applications for update
  using (
    auth.uid() = user_id
    and status = 'pending'
  )
  with check (
    auth.uid() = user_id
    and status = 'pending'
    and reviewer_id is null
    and reviewer_note is null
  );

-- ---- partner_profiles RLS ----
drop policy if exists "Partner profiles are publicly readable" on public.partner_profiles;
create policy "Partner profiles are publicly readable"
  on public.partner_profiles for select using (true);

drop policy if exists "Partners update own profile" on public.partner_profiles;
create policy "Partners update own profile"
  on public.partner_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---- listings RLS ----
drop policy if exists "Active listings are publicly readable" on public.listings;
create policy "Active listings are publicly readable"
  on public.listings for select
  using (status = 'active');

drop policy if exists "Partners see own listings" on public.listings;
create policy "Partners see own listings"
  on public.listings for select
  using (
    exists (
      select 1 from public.partner_profiles pp
      where pp.id = listings.partner_id
        and pp.user_id = auth.uid()
    )
  );

drop policy if exists "Partners create own listings" on public.listings;
create policy "Partners create own listings"
  on public.listings for insert
  with check (
    exists (
      select 1 from public.partner_profiles pp
      where pp.id = partner_id
        and pp.user_id = auth.uid()
        and pp.verified = true
    )
  );

drop policy if exists "Partners update own listings" on public.listings;
create policy "Partners update own listings"
  on public.listings for update
  using (
    exists (
      select 1 from public.partner_profiles pp
      where pp.id = listings.partner_id
        and pp.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.partner_profiles pp
      where pp.id = partner_id
        and pp.user_id = auth.uid()
    )
  );

drop policy if exists "Partners delete own listings" on public.listings;
create policy "Partners delete own listings"
  on public.listings for delete
  using (
    exists (
      select 1 from public.partner_profiles pp
      where pp.id = listings.partner_id
        and pp.user_id = auth.uid()
    )
  );

-- ---- listing_images RLS ----
drop policy if exists "Listing images readable if listing is active" on public.listing_images;
create policy "Listing images readable if listing is active"
  on public.listing_images for select
  using (
    exists (
      select 1 from public.listings l
      where l.id = listing_images.listing_id
        and l.status = 'active'
    )
  );

drop policy if exists "Partners manage own listing images" on public.listing_images;
create policy "Partners manage own listing images"
  on public.listing_images for all
  using (
    exists (
      select 1 from public.listings l
      join public.partner_profiles pp on pp.id = l.partner_id
      where l.id = listing_images.listing_id
        and pp.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.listings l
      join public.partner_profiles pp on pp.id = l.partner_id
      where l.id = listing_id
        and pp.user_id = auth.uid()
    )
  );

-- ── Profile & Role Auto-Creation Trigger ─────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'customer')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Backfill Existing Users ──────────────────────────────────
insert into public.profiles (id, display_name)
select 
  u.id,
  coalesce(
    u.raw_user_meta_data->>'display_name',
    u.raw_user_meta_data->>'full_name',
    split_part(u.email, '@', 1)
  )
from auth.users u
on conflict (id) do nothing;

insert into public.user_roles (user_id, role)
select u.id, 'customer'
from auth.users u
on conflict (user_id, role) do nothing;

-- ── Storage Bucket & Policies ────────────────────────────────
insert into storage.buckets (id, name, public)
values ('listing-images', 'listing-images', true)
on conflict (id) do nothing;

drop policy if exists "Allow public uploads for seeding" on storage.objects;
create policy "Allow public uploads for seeding"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'listing-images');

drop policy if exists "Allow public reads" on storage.objects;
create policy "Allow public reads"
  on storage.objects for select
  to public
  using (bucket_id = 'listing-images');

drop policy if exists "Allow authenticated deletes" on storage.objects;
create policy "Allow authenticated deletes"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'listing-images');