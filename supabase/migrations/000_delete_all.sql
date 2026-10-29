-- ============================================================
-- STEP 0: CLEAN RESET OF PUBLIC TABLES
-- (Does NOT delete your Storage images or Auth users)
-- ============================================================
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.is_admin() cascade;

drop table if exists public.experience_bookings cascade;
drop table if exists public.rental_bookings cascade;
drop table if exists public.order_items cascade;
drop table if exists public.orders cascade;
drop table if exists public.listing_images cascade;
drop table if exists public.listings cascade;
drop table if exists public.partner_profiles cascade;
drop table if exists public.partner_applications cascade;
drop table if exists public.user_roles cascade;
drop table if exists public.profiles cascade;