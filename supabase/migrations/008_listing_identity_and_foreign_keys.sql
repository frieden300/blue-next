-- ============================================================
-- PROJECT BLUE — Migration 008: Canonical Listing Identity & Transactional Foreign Key Hardening
-- File: supabase/migrations/008_listing_identity_and_foreign_keys.sql
-- ============================================================

-- -----------------------------------------------------------------------------
-- PRE-FLIGHT VERIFICATION QUERIES (Read-Only)
-- -----------------------------------------------------------------------------
/*
-- 1. Check for orphaned listing_ids:
SELECT 'order_items' AS table_name, count(*) AS orphan_count
FROM public.order_items oi
LEFT JOIN public.listings l ON l.id = oi.listing_id
WHERE oi.listing_id IS NOT NULL AND l.id IS NULL
UNION ALL
SELECT 'rental_bookings', count(*)
FROM public.rental_bookings rb
LEFT JOIN public.listings l ON l.id = rb.listing_id
WHERE rb.listing_id IS NOT NULL AND l.id IS NULL
UNION ALL
SELECT 'experience_bookings', count(*)
FROM public.experience_bookings eb
LEFT JOIN public.listings l ON l.id = eb.listing_id
WHERE eb.listing_id IS NOT NULL AND l.id IS NULL;

-- 2. Inspect current foreign-key constraint names and ON DELETE behaviors:
-- confdeltype: 'c' = CASCADE, 'r' = RESTRICT, 'a' = NO ACTION, 'n' = SET NULL
SELECT
  conname AS constraint_name,
  conrelid::regclass AS table_name,
  confrelid::regclass AS referenced_table,
  CASE confdeltype
    WHEN 'c' THEN 'CASCADE (Dangerous on transactional entities)'
    WHEN 'n' THEN 'SET NULL'
    WHEN 'r' THEN 'RESTRICT (Safe - protects against deletion)'
    WHEN 'a' THEN 'NO ACTION'
    ELSE confdeltype::text
  END AS on_delete_action
FROM pg_constraint
WHERE contype = 'f'
  AND conrelid::regclass::text IN (
    'public.order_items',
    'public.rental_bookings',
    'public.experience_bookings',
    'public.experience_sessions',
    'public.listings'
  )
  AND confrelid::regclass::text IN (
    'public.listings',
    'public.partner_profiles',
    'public.experience_sessions'
  );
*/

-- -----------------------------------------------------------------------------
-- MIGRATION 008: EXECUTE THE FOLLOWING STATEMENTS IN SUPABASE SQL EDITOR
-- -----------------------------------------------------------------------------
BEGIN;

-- ── 1. Enforce NOT NULL on listing_id in transactional tables ──
ALTER TABLE public.order_items
  ALTER COLUMN listing_id SET NOT NULL;

ALTER TABLE public.rental_bookings
  ALTER COLUMN listing_id SET NOT NULL;

ALTER TABLE public.experience_bookings
  ALTER COLUMN listing_id SET NOT NULL;

-- ── 2. Replace CASCADE with RESTRICT on Order Items ───────────
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT conname
    FROM pg_constraint
    WHERE contype = 'f'
      AND conrelid = 'public.order_items'::regclass
      AND confrelid = 'public.listings'::regclass
  ) LOOP
    EXECUTE format('ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS %I;', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_listing_id_fkey
  FOREIGN KEY (listing_id)
  REFERENCES public.listings(id)
  ON DELETE RESTRICT;

-- ── 3. Replace CASCADE with RESTRICT on Rental Bookings ────────
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT conname
    FROM pg_constraint
    WHERE contype = 'f'
      AND conrelid = 'public.rental_bookings'::regclass
      AND confrelid = 'public.listings'::regclass
  ) LOOP
    EXECUTE format('ALTER TABLE public.rental_bookings DROP CONSTRAINT IF EXISTS %I;', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.rental_bookings
  ADD CONSTRAINT rental_bookings_listing_id_fkey
  FOREIGN KEY (listing_id)
  REFERENCES public.listings(id)
  ON DELETE RESTRICT;

-- ── 4. Replace CASCADE with RESTRICT on Experience Bookings ────
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT conname
    FROM pg_constraint
    WHERE contype = 'f'
      AND conrelid = 'public.experience_bookings'::regclass
      AND confrelid = 'public.listings'::regclass
  ) LOOP
    EXECUTE format('ALTER TABLE public.experience_bookings DROP CONSTRAINT IF EXISTS %I;', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.experience_bookings
  ADD CONSTRAINT experience_bookings_listing_id_fkey
  FOREIGN KEY (listing_id)
  REFERENCES public.listings(id)
  ON DELETE RESTRICT;

-- ── 5. Replace CASCADE with RESTRICT on Partner Profile -> Listings ──
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT conname
    FROM pg_constraint
    WHERE contype = 'f'
      AND conrelid = 'public.listings'::regclass
      AND confrelid = 'public.partner_profiles'::regclass
  ) LOOP
    EXECUTE format('ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS %I;', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.listings
  ADD CONSTRAINT listings_partner_id_fkey
  FOREIGN KEY (partner_id)
  REFERENCES public.partner_profiles(id)
  ON DELETE RESTRICT;

-- ── 6. Replace CASCADE with RESTRICT on Experience Sessions -> Listings ──
-- Ensures a listing cannot be deleted while it has departure sessions.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT conname
    FROM pg_constraint
    WHERE contype = 'f'
      AND conrelid = 'public.experience_sessions'::regclass
      AND confrelid = 'public.listings'::regclass
  ) LOOP
    EXECUTE format('ALTER TABLE public.experience_sessions DROP CONSTRAINT IF EXISTS %I;', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.experience_sessions
  ADD CONSTRAINT experience_sessions_listing_id_fkey
  FOREIGN KEY (listing_id)
  REFERENCES public.listings(id)
  ON DELETE RESTRICT;

-- ── 7. Update delete_experience_session RPC to Archive Sessions with History ──
-- Prevents hard-deleting sessions that have historical bookings so session_id is never set to NULL.
CREATE OR REPLACE FUNCTION public.delete_experience_session(
  p_session_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_has_upcoming BOOLEAN;
  v_has_any_bookings BOOLEAN;
BEGIN
  SELECT s.*, pp.user_id
  INTO v_session
  FROM public.experience_sessions s
  JOIN public.listings l ON l.id = s.listing_id
  JOIN public.partner_profiles pp ON pp.id = l.partner_id
  WHERE s.id = p_session_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session not found.');
  END IF;

  IF v_session.user_id <> auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied.');
  END IF;

  -- Block deletion if there are upcoming confirmed bookings
  SELECT EXISTS(
    SELECT 1
    FROM public.experience_bookings
    WHERE session_id = p_session_id
      AND status = 'confirmed'
      AND booking_date >= CURRENT_DATE
  ) INTO v_has_upcoming;

  IF v_has_upcoming THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot delete session with upcoming confirmed bookings. Please mark it inactive instead.'
    );
  END IF;

  -- Check if there are historical bookings referencing this session
  SELECT EXISTS(
    SELECT 1
    FROM public.experience_bookings
    WHERE session_id = p_session_id
  ) INTO v_has_any_bookings;

  IF v_has_any_bookings THEN
    -- Archive the session to preserve historical booking data and session_id linkage
    UPDATE public.experience_sessions
    SET status = 'inactive',
        updated_at = now()
    WHERE id = p_session_id;

    RETURN jsonb_build_object(
      'success', true,
      'archived', true,
      'message', 'Session has historical bookings and was safely archived as inactive.'
    );
  END IF;

  DELETE FROM public.experience_sessions WHERE id = p_session_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_experience_session(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_experience_session(uuid) TO authenticated;

-- ── 8. Performance Indexes on Foreign Keys ─────────────────────
CREATE INDEX IF NOT EXISTS idx_order_items_listing_id
  ON public.order_items(listing_id);

CREATE INDEX IF NOT EXISTS idx_rental_bookings_listing_id
  ON public.rental_bookings(listing_id);

CREATE INDEX IF NOT EXISTS idx_experience_bookings_listing_id
  ON public.experience_bookings(listing_id);

CREATE INDEX IF NOT EXISTS idx_experience_sessions_listing_id
  ON public.experience_sessions(listing_id);

CREATE INDEX IF NOT EXISTS idx_experience_bookings_session_id
  ON public.experience_bookings(session_id);

CREATE INDEX IF NOT EXISTS idx_listings_partner_id
  ON public.listings(partner_id);

COMMIT;

-- -----------------------------------------------------------------------------
-- POST-MIGRATION VERIFICATION QUERY
-- -----------------------------------------------------------------------------
/*
SELECT
  conname AS constraint_name,
  conrelid::regclass AS table_name,
  confrelid::regclass AS referenced_table,
  CASE confdeltype
    WHEN 'r' THEN 'RESTRICT (Safe)'
    WHEN 'c' THEN 'CASCADE'
    WHEN 'n' THEN 'SET NULL'
    ELSE confdeltype::text
  END AS on_delete_action
FROM pg_constraint
WHERE contype = 'f'
  AND conname IN (
    'order_items_listing_id_fkey',
    'rental_bookings_listing_id_fkey',
    'experience_bookings_listing_id_fkey',
    'listings_partner_id_fkey',
    'experience_sessions_listing_id_fkey',
    'experience_bookings_session_id_fkey',
    'listing_images_listing_id_fkey',
    'order_items_order_id_fkey'
  )
ORDER BY table_name, constraint_name;
*/
