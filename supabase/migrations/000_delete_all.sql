-- ============================================================
-- PROJECT BLUE — Complete Clean Reset of Public Schema
-- File: supabase/migrations/000_delete_all.sql
-- (Does NOT delete your Storage images or Auth users)
-- ============================================================

-- ── 1. Drop Triggers ─────────────────────────────────────────
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists trg_restore_stock_on_order_cancel on public.orders;

-- ── 2. Drop Custom RPCs and Functions ────────────────────────
drop function if exists public.handle_new_user() cascade;
drop function if exists public.is_admin() cascade;
drop function if exists public.book_experience(uuid, date, int, uuid) cascade;
drop function if exists public.book_experience(uuid, date, int) cascade;
drop function if exists public.book_rental(uuid, date, date, int) cascade;
drop function if exists public.create_order(jsonb) cascade;
drop function if exists public.get_experience_sessions_availability(uuid, date) cascade;
drop function if exists public.delete_experience_session(uuid) cascade;
drop function if exists public.update_experience_session(uuid, int, text) cascade;
drop function if exists public.get_next_available_rental_date(uuid, int) cascade;
drop function if exists public.check_rental_availability(uuid, date, date, int) cascade;
drop function if exists public.restore_stock_on_order_cancel() cascade;
drop function if exists public.update_rental_inventory(uuid, int) cascade;
drop function if exists public.reset_password_by_identifier(text, text) cascade;

-- ── 3. Drop Public Tables (in reverse dependency order) ──────
drop table if exists public.experience_bookings cascade;
drop table if exists public.experience_sessions cascade;
drop table if exists public.rental_bookings cascade;
drop table if exists public.order_items cascade;
drop table if exists public.orders cascade;
drop table if exists public.listing_images cascade;
drop table if exists public.listings cascade;
drop table if exists public.partner_profiles cascade;
drop table if exists public.partner_applications cascade;
drop table if exists public.user_roles cascade;
drop table if exists public.profiles cascade;