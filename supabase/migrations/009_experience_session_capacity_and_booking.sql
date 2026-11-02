-- ============================================================
-- PROJECT BLUE — Migration 009: Experience Departure Session Capacity & Booking Enforcement
-- File: supabase/migrations/009_experience_session_capacity_and_booking.sql
-- ============================================================

-- -----------------------------------------------------------------------------
-- PRE-FLIGHT VERIFICATION QUERIES (Read-Only)
-- -----------------------------------------------------------------------------
/*
-- 1. Inspect existing experience sessions and their current statuses:
SELECT id, listing_id, departure_time, max_capacity, status
FROM public.experience_sessions
ORDER BY listing_id, departure_time;

-- 2. Inspect experience bookings and session_id linkage:
SELECT
  count(*) AS total_bookings,
  count(session_id) AS bookings_with_session,
  count(*) - count(session_id) AS date_only_bookings
FROM public.experience_bookings;
*/

-- -----------------------------------------------------------------------------
-- MIGRATION 009: EXECUTE THE FOLLOWING STATEMENTS IN SUPABASE SQL EDITOR
-- -----------------------------------------------------------------------------
BEGIN;

-- ── 1. Hardened Session Availability RPC ──────────────────────
-- Returns canonical keys (both session_id and id, remaining_spots and available_spots,
-- status and is_available) for robust schema-action synchronization.
CREATE OR REPLACE FUNCTION public.get_experience_sessions_availability(
  p_listing_id uuid,
  p_booking_date date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'session_id', s.id,
      'departure_time', s.departure_time,
      'label', s.label,
      'max_capacity', s.max_capacity,
      'status', s.status,
      'is_available', (s.status = 'active'),
      'booked_guests', coalesce(b.booked_count, 0),
      'remaining_spots', greatest(0, s.max_capacity - coalesce(b.booked_count, 0)),
      'available_spots', greatest(0, s.max_capacity - coalesce(b.booked_count, 0))
    ) ORDER BY s.departure_time
  ), '[]'::jsonb)
  INTO v_res
  FROM public.experience_sessions s
  LEFT JOIN (
    SELECT session_id, sum(guests) AS booked_count
    FROM public.experience_bookings
    WHERE booking_date = p_booking_date
      AND status = 'confirmed'
    GROUP BY session_id
  ) b ON b.session_id = s.id
  WHERE s.listing_id = p_listing_id
    AND s.status = 'active';

  RETURN v_res;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_experience_sessions_availability(uuid, date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_experience_sessions_availability(uuid, date) TO anon, authenticated;

-- ── 2. Authoritative Atomic Experience Booking RPC ────────────
-- Atomically serializes bookings, enforces session selection when sessions exist,
-- row-locks listing & session, checks remaining capacity against confirmed bookings,
-- and inserts the reservation with verified session and pricing.
CREATE OR REPLACE FUNCTION public.book_experience(
  p_listing_id uuid,
  p_booking_date date,
  p_guests int,
  p_session_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_listing record;
  v_session record;
  v_has_sessions boolean;
  v_effective_capacity int;
  v_booked_guests int;
  v_departure_label text := null;
  v_unit_price numeric(10, 2);
  v_total_amount numeric(12, 2);
  v_booking_id uuid;
BEGIN
  -- 1. Check authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: You must be signed in to book an experience.');
  END IF;

  -- 2. Validate input parameters
  IF p_listing_id IS NULL OR p_booking_date IS NULL OR p_guests IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing required booking parameters.');
  END IF;

  IF p_guests < 1 OR p_guests > 50 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Guest count must be between 1 and 50.');
  END IF;

  IF p_booking_date < current_date THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking date cannot be in the past.');
  END IF;

  -- 3. Lock listing row for update to serialize concurrent reservations for this experience
  SELECT id, title, price_from, status, category, max_capacity
  INTO v_listing
  FROM public.listings
  WHERE id = p_listing_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Experience listing not found.');
  END IF;

  IF v_listing.status <> 'active' OR v_listing.category NOT IN ('experience','diving','snorkeling','boat_tour','guided') THEN
    RETURN jsonb_build_object('success', false, 'error', 'This experience is no longer active or available.');
  END IF;

  -- Check if this listing has any configured departure sessions
  SELECT EXISTS (
    SELECT 1 FROM public.experience_sessions WHERE listing_id = p_listing_id
  ) INTO v_has_sessions;

  -- 4. Session or Date-only capacity validation
  IF v_has_sessions THEN
    -- If sessions are configured, a valid departure session is strictly mandatory
    IF p_session_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Please select a departure time slot for this experience.'
      );
    END IF;

    -- Lock and validate session row
    SELECT id, listing_id, departure_time, max_capacity, status, label
    INTO v_session
    FROM public.experience_sessions
    WHERE id = p_session_id
    FOR UPDATE;

    IF NOT FOUND OR v_session.listing_id <> p_listing_id THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Selected departure time is invalid for this experience.'
      );
    END IF;

    IF v_session.status <> 'active' THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'This departure session is no longer active.'
      );
    END IF;

    v_effective_capacity := v_session.max_capacity;
    v_departure_label := coalesce(v_session.label, v_session.departure_time);

    -- Calculate committed booked guests for this specific session and calendar date
    SELECT coalesce(sum(guests), 0)
    INTO v_booked_guests
    FROM public.experience_bookings
    WHERE session_id = p_session_id
      AND booking_date = p_booking_date
      AND status = 'confirmed';

  ELSE
    -- Date-only booking for experiences with no configured departure slots
    IF p_session_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'This experience operates on full-day capacity and does not use departure slots.'
      );
    END IF;

    v_effective_capacity := v_listing.max_capacity;

    -- Calculate committed booked guests for this listing on this calendar date
    SELECT coalesce(sum(guests), 0)
    INTO v_booked_guests
    FROM public.experience_bookings
    WHERE listing_id = p_listing_id
      AND booking_date = p_booking_date
      AND status = 'confirmed';
  END IF;

  -- 5. Atomically validate remaining capacity
  IF (v_booked_guests + p_guests) > v_effective_capacity THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Insufficient capacity: %s guest(s) requested, but only %s spot(s) remaining for %s%s.',
        p_guests,
        greatest(0, v_effective_capacity - v_booked_guests),
        p_booking_date,
        CASE WHEN v_departure_label IS NOT NULL THEN format(' (%s)', v_departure_label) ELSE '' END
      )
    );
  END IF;

  -- 6. Trusted price calculation from verified listing price
  v_unit_price := v_listing.price_from;
  v_total_amount := v_unit_price * p_guests;

  -- 7. Insert confirmed experience booking atomically
  INSERT INTO public.experience_bookings (
    user_id,
    listing_id,
    listing_title,
    booking_date,
    departure_time,
    session_id,
    guests,
    unit_price,
    total_amount,
    status
  ) VALUES (
    v_user_id,
    p_listing_id,
    v_listing.title,
    p_booking_date,
    coalesce(v_session.departure_time, v_departure_label),
    p_session_id,
    p_guests,
    v_unit_price,
    v_total_amount,
    'confirmed'
  ) RETURNING id INTO v_booking_id;

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'total_amount', v_total_amount,
    'unit_price', v_unit_price,
    'guests', p_guests,
    'departure_time', coalesce(v_session.departure_time, v_departure_label)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.book_experience(uuid, date, int, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.book_experience(uuid, date, int, uuid) TO authenticated;

COMMIT;
