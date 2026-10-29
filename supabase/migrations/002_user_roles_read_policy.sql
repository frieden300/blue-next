-- ============================================================
-- PROJECT BLUE — Phase 3 Database Migration
-- File: supabase/migrations/002_user_roles_read_policy.sql
-- Migration 002: User roles read policy
-- ============================================================

drop policy if exists "Users can read own roles" on public.user_roles;

create policy "Users can read own roles"
  on public.user_roles for select
  using (auth.uid() = user_id);

comment on policy "Users can read own roles" on public.user_roles is
  'Allows authenticated users to inspect their own roles. Modification remains server/admin-only.';