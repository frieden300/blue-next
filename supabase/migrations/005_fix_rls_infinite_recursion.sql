-- ============================================================
-- PROJECT BLUE — Migration 005: Fix RLS Infinite Recursion & Admin Permissions
-- File: supabase/migrations/005_fix_rls_infinite_recursion.sql
-- ============================================================

-- Step 1: Stable security-definer function — runs as owner, bypasses RLS
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

-- Step 2: Drop all recursion-prone admin policies
drop policy if exists "Admins can read all roles"            on public.user_roles;
drop policy if exists "Admins can insert user roles"         on public.user_roles;
drop policy if exists "Admins can delete user roles"         on public.user_roles;
drop policy if exists "Admins can read all listings"         on public.listings;
drop policy if exists "Admins can insert listings"           on public.listings;
drop policy if exists "Admins can update listings"           on public.listings;
drop policy if exists "Admins can delete listings"           on public.listings;
drop policy if exists "Admins can read all listing images"   on public.listing_images;
drop policy if exists "Admins can manage all listing images" on public.listing_images;
drop policy if exists "Admins can read all applications"     on public.partner_applications;
drop policy if exists "Admins can update applications"       on public.partner_applications;
drop policy if exists "Admins can delete applications"       on public.partner_applications;
drop policy if exists "Admins can insert partner profiles"   on public.partner_profiles;
drop policy if exists "Admins can update partner profiles"   on public.partner_profiles;
drop policy if exists "Admins can delete partner profiles"   on public.partner_profiles;

-- Step 3: Recreate using is_admin() + add Delete/Insert policies for Admin (Issues #5, #6, #7)
create policy "Admins can read all roles"
  on public.user_roles for select
  using (public.is_admin() or auth.uid() = user_id);

create policy "Admins can insert user roles"
  on public.user_roles for insert
  with check (public.is_admin());

create policy "Admins can delete user roles"
  on public.user_roles for delete
  using (public.is_admin());

create policy "Admins can read all listings"
  on public.listings for select
  using (public.is_admin());

create policy "Admins can insert listings"
  on public.listings for insert
  with check (public.is_admin());

create policy "Admins can update listings"
  on public.listings for update
  using (public.is_admin());

create policy "Admins can delete listings"
  on public.listings for delete
  using (public.is_admin());

create policy "Admins can manage all listing images"
  on public.listing_images for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can read all applications"
  on public.partner_applications for select
  using (public.is_admin());

create policy "Admins can update applications"
  on public.partner_applications for update
  using (public.is_admin());

create policy "Admins can delete applications"
  on public.partner_applications for delete
  using (public.is_admin());

create policy "Admins can insert partner profiles"
  on public.partner_profiles for insert
  with check (public.is_admin());

create policy "Admins can update partner profiles"
  on public.partner_profiles for update
  using (public.is_admin());

create policy "Admins can delete partner profiles"
  on public.partner_profiles for delete
  using (public.is_admin());