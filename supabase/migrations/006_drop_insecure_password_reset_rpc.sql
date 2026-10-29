-- ============================================================
-- PROJECT BLUE — Migration 006: Drop Insecure Password Reset RPC
-- ============================================================
-- Drops the unauthenticated bypass RPC public.reset_password_by_identifier.
-- All password recoveries must go through Supabase Auth 6-digit OTP verification.

drop function if exists public.reset_password_by_identifier(text, text);
