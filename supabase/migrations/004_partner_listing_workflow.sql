-- ============================================================
-- PROJECT BLUE — Migration 004: Partner & Listing Approval Workflow
-- File: supabase/migrations/004_partner_listing_workflow.sql
-- ============================================================

-- ── 1. Add approval fields to listings ───────────────────────
alter table public.listings
  drop constraint if exists listings_status_check;

alter table public.listings
  add constraint listings_status_check
  check (status in ('draft','pending','active','paused','archived','rejected'));

alter table public.listings
  add column if not exists reviewer_id   uuid references auth.users(id),
  add column if not exists reviewer_note text,
  add column if not exists reviewed_at   timestamptz;

-- ── 2. Add service_types to partner_profiles ─────────────────
alter table public.partner_profiles
  add column if not exists service_types text[] default '{}';

-- ── 3. Admin RLS: partner_applications ───────────────────────
drop policy if exists "Admins can read all applications" on public.partner_applications;
create policy "Admins can read all applications"
  on public.partner_applications for select
  using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
  );

drop policy if exists "Admins can update applications" on public.partner_applications;
create policy "Admins can update applications"
  on public.partner_applications for update
  using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
  );

-- ── 4. Admin RLS: partner_profiles ───────────────────────────
drop policy if exists "Admins can insert partner profiles" on public.partner_profiles;
create policy "Admins can insert partner profiles"
  on public.partner_profiles for insert
  with check (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
  );

drop policy if exists "Admins can update partner profiles" on public.partner_profiles;
create policy "Admins can update partner profiles"
  on public.partner_profiles for update
  using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
  );

-- ── 5. Admin RLS: user_roles ─────────────────────────────────
drop policy if exists "Admins can insert user roles" on public.user_roles;
create policy "Admins can insert user roles"
  on public.user_roles for insert
  with check (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
  );

drop policy if exists "Admins can read all roles" on public.user_roles;
create policy "Admins can read all roles"
  on public.user_roles for select
  using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
    or auth.uid() = user_id
  );

-- ── 6. Admin RLS: listings ───────────────────────────────────
drop policy if exists "Admins can read all listings" on public.listings;
create policy "Admins can read all listings"
  on public.listings for select
  using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
  );

drop policy if exists "Admins can update listings" on public.listings;
create policy "Admins can update listings"
  on public.listings for update
  using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
  );

-- ── 7. Admin RLS: listing_images ─────────────────────────────
drop policy if exists "Admins can read all listing images" on public.listing_images;
create policy "Admins can read all listing images"
  on public.listing_images for select
  using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
  );

-- ── 8. Allow applicants & approved partners to re-apply / upgrade services (Issue #4) ──
drop policy if exists "Applicants can update own pending application" on public.partner_applications;
create policy "Applicants can update own pending application"
  on public.partner_applications for update
  using (
    auth.uid() = user_id
    and status in ('pending', 'rejected', 'approved')
  )
  with check (
    auth.uid() = user_id
    and status = 'pending'
    and reviewer_id is null
    and reviewer_note is null
  );

-- ── 9. Grant Admin Role ──────────────────────────────────────
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users
where email = 'friedeneoo@gmail.com'
on conflict (user_id, role) do nothing;