-- ============================================================
-- PROJECT BLUE — Migration 007: Complete Inventory, Availability,
-- Partner Configuration, and Booking Concurrency Protection
-- File: supabase/migrations/007_booking_concurrency_and_inventory.sql
-- ============================================================

-- ── 1. Schema Extensions for Listings, Rentals & Gear ─────────

-- 1.1 Add rental total inventory count to listings (default 5 for existing listings)
alter table public.listings
  add column if not exists inventory_count int not null default 5 check (inventory_count >= 1);

comment on column public.listings.inventory_count is
  'Total fleet / units available for simultaneous rental reservations. Positive integer.';

-- 1.2 Add purchasable stock count to listings (default 10 for existing gear listings)
alter table public.listings
  add column if not exists stock_count int not null default 10 check (stock_count >= 0);

comment on column public.listings.stock_count is
  'Current purchasable units in stock for gear listings. Non-negative integer (0 = Sold Out).';

-- 1.3 Add max guest capacity to listings (default 10 for date-only experiences)
alter table public.listings
  add column if not exists max_capacity int not null default 10 check (max_capacity >= 1);

comment on column public.listings.max_capacity is
  'Maximum guest capacity per calendar date or session for experience listings. Positive integer.';

-- 1.4 Add reserved unit quantity to rental_bookings (default 1 for existing single bookings)
alter table public.rental_bookings
  add column if not exists quantity int not null default 1 check (quantity >= 1);

comment on column public.rental_bookings.quantity is
  'Number of units reserved for this rental booking. Positive integer.';

-- ── 2. Experience Sessions (Departure Times & Capacities) ─────

create table if not exists public.experience_sessions (
  id             uuid primary key default gen_random_uuid(),
  listing_id     uuid not null references public.listings(id) on delete cascade,
  departure_time text not null, -- e.g. '09:00', '14:00', '09:00 AM'
  max_capacity   int not null check (max_capacity >= 1),
  label          text,          -- e.g. 'Morning Dive', 'Sunset Cruise'
  status         text not null default 'active' check (status in ('active', 'inactive')),
  created_at     timestamptz not null default now(),
  constraint uq_listing_departure unique (listing_id, departure_time)
);

comment on table public.experience_sessions is
  'Partner-configured scheduled departure times with independent guest capacities.';

-- 2.1 Add session reference to experience_bookings
alter table public.experience_bookings
  add column if not exists session_id uuid references public.experience_sessions(id) on delete set null,
  add column if not exists departure_time text;

comment on column public.experience_bookings.session_id is
  'Departure session booked by the customer. Null for date-only experiences.';

-- ── 3. Performance Indexes ────────────────────────────────────

create index if not exists rental_bookings_availability_idx
  on public.rental_bookings (listing_id, status, pickup_date, return_date);

create index if not exists experience_bookings_date_idx
  on public.experience_bookings (listing_id, status, booking_date);

create index if not exists experience_bookings_session_idx
  on public.experience_bookings (session_id, booking_date, status);

create index if not exists experience_sessions_listing_idx
  on public.experience_sessions (listing_id, status);

-- ── 4. Row Level Security: experience_sessions ────────────────

alter table public.experience_sessions enable row level security;

drop policy if exists "Anyone can view active experience sessions" on public.experience_sessions;
create policy "Anyone can view active experience sessions"
  on public.experience_sessions for select
  using (
    status = 'active'
    or exists (
      select 1 from public.listings l
      join public.partner_profiles pp on pp.id = l.partner_id
      where l.id = experience_sessions.listing_id
        and pp.user_id = auth.uid()
    )
  );

drop policy if exists "Partners can insert sessions for own listings" on public.experience_sessions;
create policy "Partners can insert sessions for own listings"
  on public.experience_sessions for insert
  with check (
    exists (
      select 1 from public.listings l
      join public.partner_profiles pp on pp.id = l.partner_id
      where l.id = experience_sessions.listing_id
        and pp.user_id = auth.uid()
    )
  );

drop policy if exists "Partners can update sessions for own listings" on public.experience_sessions;
create policy "Partners can update sessions for own listings"
  on public.experience_sessions for update
  using (
    exists (
      select 1 from public.listings l
      join public.partner_profiles pp on pp.id = l.partner_id
      where l.id = experience_sessions.listing_id
        and pp.user_id = auth.uid()
    )
  );

drop policy if exists "Partners can delete sessions for own listings" on public.experience_sessions;
create policy "Partners can delete sessions for own listings"
  on public.experience_sessions for delete
  using (
    exists (
      select 1 from public.listings l
      join public.partner_profiles pp on pp.id = l.partner_id
      where l.id = experience_sessions.listing_id
        and pp.user_id = auth.uid()
    )
  );

-- ── 5. Rental Availability & Next Available Date Functions ────

-- 5.1 Helper: Find earliest next pickup date with sufficient units for duration
create or replace function public.get_next_available_rental_date(
  p_listing_id uuid,
  p_duration_days int,
  p_quantity int,
  p_from_date date default current_date,
  p_horizon_days int default 60
)
returns date
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inventory int;
  v_curr date;
  v_max_date date;
  v_ret date;
  v_max_overlap int;
begin
  select inventory_count into v_inventory
  from public.listings
  where id = p_listing_id and status = 'active' and category = 'rental';

  if not found or p_quantity > v_inventory or p_duration_days < 1 then
    return null;
  end if;

  v_curr := greatest(current_date, coalesce(p_from_date, current_date));
  v_max_date := v_curr + greatest(1, least(p_horizon_days, 180));

  while v_curr <= v_max_date loop
    v_ret := v_curr + p_duration_days;

    -- Check if any day in [v_curr, v_ret) exceeds available inventory
    select coalesce(max(day_reserved), 0)
    into v_max_overlap
    from (
      select coalesce(sum(b.quantity), 0) as day_reserved
      from generate_series(v_curr, v_ret - 1, interval '1 day') as d
      left join public.rental_bookings b
        on b.listing_id = p_listing_id
       and b.status = 'confirmed'
       and b.pickup_date <= d::date
       and b.return_date > d::date
      group by d::date
    ) sub;

    if (v_max_overlap + p_quantity) <= v_inventory then
      return v_curr;
    end if;

    v_curr := v_curr + 1;
  end loop;

  return null;
end;
$$;

comment on function public.get_next_available_rental_date is
  'Finds the earliest calendar pickup date where the requested quantity is available for the full duration.';

-- 5.2 Real-time availability check for rental dates & quantity
create or replace function public.check_rental_availability(
  p_listing_id uuid,
  p_pickup_date date,
  p_return_date date,
  p_quantity int default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing record;
  v_duration int;
  v_max_reserved int;
  v_remaining int;
  v_next_date date := null;
begin
  if p_listing_id is null or p_pickup_date is null or p_return_date is null then
    return jsonb_build_object('available', false, 'error', 'Missing parameters.');
  end if;

  if p_return_date <= p_pickup_date then
    return jsonb_build_object('available', false, 'error', 'Return date must be after pickup date.');
  end if;

  select id, title, price_from, status, category, inventory_count
  into v_listing
  from public.listings
  where id = p_listing_id;

  if not found or v_listing.status <> 'active' or v_listing.category <> 'rental' then
    return jsonb_build_object('available', false, 'error', 'Listing not available.');
  end if;

  v_duration := p_return_date - p_pickup_date;

  -- Max units reserved on any single day in [pickup_date, return_date)
  select coalesce(max(day_reserved), 0)
  into v_max_reserved
  from (
    select coalesce(sum(b.quantity), 0) as day_reserved
    from generate_series(p_pickup_date, p_return_date - 1, interval '1 day') as d
    left join public.rental_bookings b
      on b.listing_id = p_listing_id
     and b.status = 'confirmed'
     and b.pickup_date <= d::date
     and b.return_date > d::date
    group by d::date
  ) sub;

  v_remaining := greatest(0, v_listing.inventory_count - v_max_reserved);

  if (v_max_reserved + p_quantity) <= v_listing.inventory_count then
    return jsonb_build_object(
      'available', true,
      'inventory_count', v_listing.inventory_count,
      'max_reserved', v_max_reserved,
      'remaining', v_remaining,
      'next_available_date', null
    );
  else
    -- Find next available date starting after pickup date
    v_next_date := public.get_next_available_rental_date(
      p_listing_id,
      v_duration,
      p_quantity,
      p_pickup_date + 1,
      60
    );

    return jsonb_build_object(
      'available', false,
      'inventory_count', v_listing.inventory_count,
      'max_reserved', v_max_reserved,
      'remaining', v_remaining,
      'next_available_date', v_next_date
    );
  end if;
end;
$$;

-- ── 6. Atomic Rental Booking Function ──────────────────────────

create or replace function public.book_rental(
  p_listing_id uuid,
  p_pickup_date date,
  p_return_date date,
  p_quantity int default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_listing record;
  v_max_reserved int;
  v_duration_days int;
  v_daily_rate numeric(10, 2);
  v_rental_total numeric(12, 2);
  v_deposit_amount numeric(10, 2);
  v_booking_id uuid;
  v_next_date date;
begin
  -- 1. Check authenticated user
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'Unauthorized: You must be signed in to book a rental.');
  end if;

  -- 2. Validate input parameters
  if p_listing_id is null or p_pickup_date is null or p_return_date is null then
    return jsonb_build_object('success', false, 'error', 'Missing required booking parameters.');
  end if;

  if p_quantity is null or p_quantity < 1 then
    return jsonb_build_object('success', false, 'error', 'Quantity must be at least 1.');
  end if;

  if p_pickup_date < current_date then
    return jsonb_build_object('success', false, 'error', 'Pickup date cannot be in the past.');
  end if;

  if p_return_date <= p_pickup_date then
    return jsonb_build_object('success', false, 'error', 'Return date must be after pickup date.');
  end if;

  v_duration_days := p_return_date - p_pickup_date;
  if v_duration_days < 1 or v_duration_days > 365 then
    return jsonb_build_object('success', false, 'error', 'Rental duration must be between 1 and 365 days.');
  end if;

  -- 3. Lock listing row for update to serialize concurrent reservations for this listing
  select id, title, price_from, status, category, inventory_count
  into v_listing
  from public.listings
  where id = p_listing_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Rental listing not found.');
  end if;

  if v_listing.status <> 'active' or v_listing.category <> 'rental' then
    return jsonb_build_object('success', false, 'error', 'This rental item is no longer active or available.');
  end if;

  if p_quantity > v_listing.inventory_count then
    return jsonb_build_object(
      'success', false,
      'error', format('Requested quantity (%s) exceeds total listing inventory (%s).', p_quantity, v_listing.inventory_count)
    );
  end if;

  -- 4. Calculate max reserved units across every day in the half-open interval [pickup_date, return_date)
  select coalesce(max(day_reserved), 0)
  into v_max_reserved
  from (
    select coalesce(sum(b.quantity), 0) as day_reserved
    from generate_series(p_pickup_date, p_return_date - 1, interval '1 day') as d
    left join public.rental_bookings b
      on b.listing_id = p_listing_id
     and b.status = 'confirmed'
     and b.pickup_date <= d::date
     and b.return_date > d::date
    group by d::date
  ) sub;

  if (v_max_reserved + p_quantity) > v_listing.inventory_count then
    -- Look up next available date suggestion
    v_next_date := public.get_next_available_rental_date(
      p_listing_id,
      v_duration_days,
      p_quantity,
      p_pickup_date + 1,
      60
    );

    return jsonb_build_object(
      'success', false,
      'error', format('Insufficient inventory: %s unit(s) requested, but only %s available for the selected dates.',
        p_quantity,
        greatest(0, v_listing.inventory_count - v_max_reserved)),
      'remaining', greatest(0, v_listing.inventory_count - v_max_reserved),
      'next_available_date', v_next_date
    );
  end if;

  -- 5. Calculate trusted pricing
  v_daily_rate := v_listing.price_from;
  v_rental_total := v_daily_rate * v_duration_days * p_quantity;
  v_deposit_amount := round(v_daily_rate * 1.5) * p_quantity;

  -- 6. Insert confirmed rental booking
  insert into public.rental_bookings (
    user_id,
    listing_id,
    listing_title,
    pickup_date,
    return_date,
    duration_days,
    daily_rate,
    rental_total,
    deposit_amount,
    quantity,
    status
  ) values (
    v_user_id,
    p_listing_id,
    v_listing.title,
    p_pickup_date,
    p_return_date,
    v_duration_days,
    v_daily_rate,
    v_rental_total,
    v_deposit_amount,
    p_quantity,
    'confirmed'
  ) returning id into v_booking_id;

  return jsonb_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'rental_total', v_rental_total,
    'deposit_amount', v_deposit_amount,
    'duration_days', v_duration_days,
    'quantity', p_quantity
  );
end;
$$;

-- ── 7. Atomic Experience Booking Function ──────────────────────

-- 7.1 Fetch session availability for a given date
create or replace function public.get_experience_sessions_availability(
  p_listing_id uuid,
  p_booking_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res jsonb;
begin
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'departure_time', s.departure_time,
      'label', s.label,
      'max_capacity', s.max_capacity,
      'status', s.status,
      'booked_guests', coalesce(b.booked_count, 0),
      'remaining_spots', greatest(0, s.max_capacity - coalesce(b.booked_count, 0))
    ) order by s.departure_time
  ), '[]'::jsonb)
  into v_res
  from public.experience_sessions s
  left join (
    select session_id, sum(guests) as booked_count
    from public.experience_bookings
    where booking_date = p_booking_date
      and status = 'confirmed'
    group by session_id
  ) b on b.session_id = s.id
  where s.listing_id = p_listing_id
    and s.status = 'active';

  return v_res;
end;
$$;

-- 7.2 Atomic booking with session support
create or replace function public.book_experience(
  p_listing_id uuid,
  p_booking_date date,
  p_guests int,
  p_session_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_listing record;
  v_session record;
  v_effective_capacity int;
  v_booked_guests int;
  v_departure_label text := null;
  v_unit_price numeric(10, 2);
  v_total_amount numeric(12, 2);
  v_booking_id uuid;
begin
  -- 1. Check authenticated user
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'Unauthorized: You must be signed in to book an experience.');
  end if;

  -- 2. Validate input parameters
  if p_listing_id is null or p_booking_date is null or p_guests is null then
    return jsonb_build_object('success', false, 'error', 'Missing required booking parameters.');
  end if;

  if p_guests < 1 or p_guests > 50 then
    return jsonb_build_object('success', false, 'error', 'Guest count must be between 1 and 50.');
  end if;

  if p_booking_date < current_date then
    return jsonb_build_object('success', false, 'error', 'Booking date cannot be in the past.');
  end if;

  -- 3. Lock listing row for update to serialize concurrent reservations for this experience
  select id, title, price_from, status, category, max_capacity
  into v_listing
  from public.listings
  where id = p_listing_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Experience listing not found.');
  end if;

  if v_listing.status <> 'active' or v_listing.category not in ('experience','diving','snorkeling','boat_tour','guided') then
    return jsonb_build_object('success', false, 'error', 'This experience is no longer active or available.');
  end if;

  -- 4. Session or Date-only capacity validation
  if p_session_id is not null then
    -- Lock and validate session
    select id, listing_id, departure_time, max_capacity, status, label
    into v_session
    from public.experience_sessions
    where id = p_session_id
    for update;

    if not found or v_session.listing_id <> p_listing_id then
      return jsonb_build_object('success', false, 'error', 'Selected departure time is invalid for this experience.');
    end if;

    if v_session.status <> 'active' then
      return jsonb_build_object('success', false, 'error', 'This departure session is no longer active.');
    end if;

    v_effective_capacity := v_session.max_capacity;
    v_departure_label := coalesce(v_session.label, v_session.departure_time);

    -- Calculate booked guests for this specific session and calendar date
    select coalesce(sum(guests), 0)
    into v_booked_guests
    from public.experience_bookings
    where session_id = p_session_id
      and booking_date = p_booking_date
      and status = 'confirmed';
  else
    -- Date-only booking: check if listing mandates sessions
    if exists (select 1 from public.experience_sessions where listing_id = p_listing_id and status = 'active') then
      return jsonb_build_object('success', false, 'error', 'Please select a departure time for this experience.');
    end if;

    v_effective_capacity := v_listing.max_capacity;

    -- Calculate booked guests for this listing on this calendar date
    select coalesce(sum(guests), 0)
    into v_booked_guests
    from public.experience_bookings
    where listing_id = p_listing_id
      and booking_date = p_booking_date
      and status = 'confirmed';
  end if;

  -- 5. Validate capacity
  if (v_booked_guests + p_guests) > v_effective_capacity then
    return jsonb_build_object(
      'success', false,
      'error', format('Insufficient capacity: %s guest(s) requested, but only %s spot(s) remaining for %s%s.',
        p_guests,
        greatest(0, v_effective_capacity - v_booked_guests),
        p_booking_date,
        case when v_departure_label is not null then format(' (%s)', v_departure_label) else '' end
      )
    );
  end if;

  -- 6. Trusted price calculation
  v_unit_price := v_listing.price_from;
  v_total_amount := v_unit_price * p_guests;

  -- 7. Insert confirmed experience booking
  insert into public.experience_bookings (
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
  ) values (
    v_user_id,
    p_listing_id,
    v_listing.title,
    p_booking_date,
    v_departure_label,
    p_session_id,
    p_guests,
    v_unit_price,
    v_total_amount,
    'confirmed'
  ) returning id into v_booking_id;

  return jsonb_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'total_amount', v_total_amount,
    'unit_price', v_unit_price,
    'guests', p_guests,
    'departure_time', v_departure_label
  );
end;
$$;

-- ── 8. Gear Order Creation & Stock Restoration ────────────────

-- 8.1 Transactional order creation with atomic stock decrement
create or replace function public.create_order(
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_order_id uuid;
  v_item jsonb;
  v_listing_id uuid;
  v_qty int;
  v_listing record;
  v_total_amount numeric(12, 2) := 0;
begin
  -- 1. Check authenticated user
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'Unauthorized: You must be signed in to place an order.');
  end if;

  -- 2. Validate items array
  if p_items is null or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('success', false, 'error', 'Your cart is empty.');
  end if;

  -- 3. Create order header
  insert into public.orders (
    user_id,
    status,
    total_amount,
    note
  ) values (
    v_user_id,
    'confirmed',
    0,
    'Demo order — academic presentation. No payment processed.'
  ) returning id into v_order_id;

  -- 4. Process line items atomically with row lock & stock decrement
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_listing_id := (v_item->>'listing_id')::uuid;
    v_qty := (v_item->>'quantity')::int;

    if v_listing_id is null or v_qty is null or v_qty < 1 or v_qty > 50 then
      raise exception 'Invalid item or quantity in order payload.';
    end if;

    -- Row-lock listing for update to serialize concurrent checkouts
    select id, title, price_from, status, category, stock_count
    into v_listing
    from public.listings
    where id = v_listing_id
    for update;

    if not found or v_listing.status <> 'active' or v_listing.category <> 'gear' then
      raise exception 'Listing "%" is no longer available.', coalesce(v_listing.title, v_listing_id::text);
    end if;

    if v_listing.stock_count < v_qty then
      raise exception 'Insufficient stock for "%": requested %, but only % remaining.',
        v_listing.title, v_qty, v_listing.stock_count;
    end if;

    -- Decrement stock atomically
    update public.listings
    set stock_count = stock_count - v_qty
    where id = v_listing.id;

    -- Insert order item
    insert into public.order_items (
      order_id,
      listing_id,
      title,
      unit_price,
      quantity,
      image_url
    ) values (
      v_order_id,
      v_listing.id,
      v_listing.title,
      v_listing.price_from,
      v_qty,
      v_item->>'image_url'
    );

    v_total_amount := v_total_amount + (v_listing.price_from * v_qty);
  end loop;

  -- 5. Update order with verified total
  update public.orders
  set total_amount = v_total_amount
  where id = v_order_id;

  return jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'total_amount', v_total_amount
  );
exception
  when others then
    return jsonb_build_object('success', false, 'error', SQLERRM);
end;
$$;

-- 8.2 Trigger to restore stock when an order is cancelled
create or replace function public.restore_stock_on_order_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'confirmed' and new.status = 'cancelled' then
    update public.listings l
    set stock_count = l.stock_count + oi.quantity
    from public.order_items oi
    where oi.order_id = new.id
      and oi.listing_id = l.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_restore_stock_on_order_cancel on public.orders;
create trigger trg_restore_stock_on_order_cancel
  after update of status on public.orders
  for each row
  execute function public.restore_stock_on_order_cancel();

-- ── 9. Partner Inventory & Session Protection Functions ───────

-- 9.1 Protect rental inventory reduction below committed bookings
create or replace function public.update_rental_inventory(
  p_listing_id uuid,
  p_inventory_count int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing record;
  v_max_committed int;
begin
  select l.*, pp.user_id
  into v_listing
  from public.listings l
  join public.partner_profiles pp on pp.id = l.partner_id
  where l.id = p_listing_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Rental listing not found.');
  end if;

  if v_listing.user_id <> auth.uid() then
    return jsonb_build_object('success', false, 'error', 'Permission denied: You do not own this listing.');
  end if;

  if p_inventory_count < 1 then
    return jsonb_build_object('success', false, 'error', 'Inventory must be at least 1 unit.');
  end if;

  -- Find peak committed units across all upcoming dates
  select coalesce(max(day_reserved), 0)
  into v_max_committed
  from (
    select coalesce(sum(b.quantity), 0) as day_reserved
    from generate_series(current_date, (current_date + interval '180 days')::date, interval '1 day') as d
    join public.rental_bookings b
      on b.listing_id = p_listing_id
     and b.status = 'confirmed'
     and b.pickup_date <= d::date
     and b.return_date > d::date
    group by d::date
  ) sub;

  if p_inventory_count < v_max_committed then
    return jsonb_build_object(
      'success', false,
      'error', format('Cannot reduce inventory to %s. %s unit(s) are already committed to overlapping confirmed bookings.',
        p_inventory_count, v_max_committed)
    );
  end if;

  update public.listings
  set inventory_count = p_inventory_count,
      updated_at = now()
  where id = p_listing_id;

  return jsonb_build_object('success', true);
end;
$$;

-- 9.2 Protect experience session capacity reduction below committed guests
create or replace function public.update_experience_session(
  p_session_id uuid,
  p_max_capacity int,
  p_status text default 'active'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
  v_max_committed int;
begin
  select s.*, l.partner_id, pp.user_id
  into v_session
  from public.experience_sessions s
  join public.listings l on l.id = s.listing_id
  join public.partner_profiles pp on pp.id = l.partner_id
  where s.id = p_session_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Session not found.');
  end if;

  if v_session.user_id <> auth.uid() then
    return jsonb_build_object('success', false, 'error', 'Permission denied: You do not own this listing.');
  end if;

  if p_max_capacity < 1 then
    return jsonb_build_object('success', false, 'error', 'Capacity must be at least 1 guest.');
  end if;

  -- Check max committed guests on any upcoming calendar date
  select coalesce(max(daily_booked), 0)
  into v_max_committed
  from (
    select sum(guests) as daily_booked
    from public.experience_bookings
    where session_id = p_session_id
      and status = 'confirmed'
      and booking_date >= current_date
    group by booking_date
  ) sub;

  if p_max_capacity < v_max_committed then
    return jsonb_build_object(
      'success', false,
      'error', format('Cannot reduce capacity to %s. %s guest(s) are already booked for an upcoming departure.',
        p_max_capacity, v_max_committed)
    );
  end if;

  update public.experience_sessions
  set max_capacity = p_max_capacity,
      status = p_status
  where id = p_session_id;

  return jsonb_build_object('success', true);
end;
$$;

-- 9.3 Protect against deleting a session that has upcoming confirmed bookings
create or replace function public.delete_experience_session(
  p_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
  v_has_upcoming boolean;
begin
  select s.*, pp.user_id
  into v_session
  from public.experience_sessions s
  join public.listings l on l.id = s.listing_id
  join public.partner_profiles pp on pp.id = l.partner_id
  where s.id = p_session_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Session not found.');
  end if;

  if v_session.user_id <> auth.uid() then
    return jsonb_build_object('success', false, 'error', 'Permission denied.');
  end if;

  select exists(
    select 1
    from public.experience_bookings
    where session_id = p_session_id
      and status = 'confirmed'
      and booking_date >= current_date
  ) into v_has_upcoming;

  if v_has_upcoming then
    return jsonb_build_object(
      'success', false,
      'error', 'Cannot delete session with upcoming confirmed bookings. Please mark it inactive instead.'
    );
  end if;

  delete from public.experience_sessions where id = p_session_id;
  return jsonb_build_object('success', true);
end;
$$;

-- ── 10. Function Permissions ───────────────────────────────────

revoke execute on function public.book_rental(uuid, date, date, int) from public, anon;
grant execute on function public.book_rental(uuid, date, date, int) to authenticated;

revoke execute on function public.check_rental_availability(uuid, date, date, int) from public, anon;
grant execute on function public.check_rental_availability(uuid, date, date, int) to authenticated, anon;

revoke execute on function public.get_next_available_rental_date(uuid, int, int, date, int) from public, anon;
grant execute on function public.get_next_available_rental_date(uuid, int, int, date, int) to authenticated, anon;

revoke execute on function public.book_experience(uuid, date, int, uuid) from public, anon;
grant execute on function public.book_experience(uuid, date, int, uuid) to authenticated;

revoke execute on function public.get_experience_sessions_availability(uuid, date) from public, anon;
grant execute on function public.get_experience_sessions_availability(uuid, date) to authenticated, anon;

revoke execute on function public.create_order(jsonb) from public, anon;
grant execute on function public.create_order(jsonb) to authenticated;

revoke execute on function public.update_rental_inventory(uuid, int) from public, anon;
grant execute on function public.update_rental_inventory(uuid, int) to authenticated;

revoke execute on function public.update_experience_session(uuid, int, text) from public, anon;
grant execute on function public.update_experience_session(uuid, int, text) to authenticated;

revoke execute on function public.delete_experience_session(uuid) from public, anon;
grant execute on function public.delete_experience_session(uuid) to authenticated;
