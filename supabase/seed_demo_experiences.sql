-- ============================================================
-- PROJECT BLUE — Demo Marine Tourism Experience Seed Data
-- File: supabase/seed_demo_experiences.sql
-- ============================================================

-- ── 1. Ensure demo partner exists ────────────────────────────
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'demo-partner@blueproject.local', '',
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{"display_name":"Blue Demo Partner"}',
  false, '', '', '', ''
)
on conflict (id) do nothing;

insert into public.profiles (id, display_name)
values ('00000000-0000-0000-0000-000000000001', 'Blue Demo Partner')
on conflict (id) do nothing;

insert into public.partner_profiles (id, user_id, business_name, description, location, verified, service_types)
values (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  'Blue Expeditions',
  'Certified marine tourism operator serving ocean experiences across coastal India.',
  'Goa, India',
  true,
  array['experience', 'sell', 'rent']
)
on conflict (id) do nothing;

-- ── 2. Insert the 8 Discover / Marine Experience Listings ────
insert into public.listings (
  id, partner_id, category, subcategory, title, description, location, price_from, duration_hours, difficulty, status
) values
  (
    '30000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000010',
    'diving',
    'diving',
    'Beginner Scuba Diving Introduction',
    'First-time ocean dive with certified PADI instructors. Includes equipment briefing, shallow water training, and a guided 45-minute open water dive down to 12 meters.',
    'Goa, India',
    4500.00,
    3.0,
    'beginner',
    'active'
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000010',
    'diving',
    'diving',
    'Advanced Reef Diving Expedition',
    'Two-tank boat excursion exploring offshore coral walls, drift trenches, and deep marine passages up to 30 meters depth. Nitrox available.',
    'Grande Island, Goa',
    7200.00,
    5.0,
    'advanced',
    'active'
  ),
  (
    '30000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000010',
    'guided',
    'guided',
    'Guided Shore Dive',
    'Convenient shore-entry dive focusing on macro life, coastal rocky drop-offs, and marine flora. Great refresher dive for certified divers.',
    'Goa, India',
    3200.00,
    2.5,
    'intermediate',
    'active'
  ),
  (
    '30000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000010',
    'snorkeling',
    'snorkeling',
    'Beginner Snorkeling Adventure',
    'Calm bay snorkeling guided by marine naturalists. All gear provided, including life vests and defogged masks. Family and beginner friendly.',
    'Goa, India',
    1800.00,
    2.0,
    'beginner',
    'active'
  ),
  (
    '30000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000010',
    'snorkeling',
    'snorkeling',
    'Coral Reef Snorkeling Tour',
    'Half-day offshore boat charter to pristine outer coral beds. Swim among clownfish, sea turtles, and vibrant tropical reef formations.',
    'Grande Island, Goa',
    2800.00,
    4.0,
    'beginner',
    'active'
  ),
  (
    '30000000-0000-0000-0000-000000000006',
    '00000000-0000-0000-0000-000000000010',
    'guided',
    'guided',
    'Guided Marine Wildlife Exploration',
    'Guided eco-expedition focused on coastal biodiversity, rays, dolphin sightings, and underwater photography. Led by local marine biologists.',
    'Goa, India',
    3900.00,
    4.0,
    'beginner',
    'active'
  ),
  (
    '30000000-0000-0000-0000-000000000007',
    '00000000-0000-0000-0000-000000000010',
    'boat_tour',
    'boat_tour',
    'Island Hopping Boat Tour',
    'Full-day scenic catamaran journey across secluded coves, rocky archipelagos, and hidden coastal bays with swim stops and lunch on board.',
    'Goa, India',
    5400.00,
    8.0,
    'beginner',
    'active'
  ),
  (
    '30000000-0000-0000-0000-000000000008',
    '00000000-0000-0000-0000-000000000010',
    'boat_tour',
    'boat_tour',
    'Sunset Ocean Cruise',
    'Cinematic evening cruise following the golden hour over open waters. Soft ambient sailing, coastal views, and light refreshments.',
    'Goa, India',
    3500.00,
    2.5,
    'beginner',
    'active'
  )
on conflict (id) do update set
  category = excluded.category,
  subcategory = excluded.subcategory,
  title = excluded.title,
  description = excluded.description,
  price_from = excluded.price_from,
  duration_hours = excluded.duration_hours,
  difficulty = excluded.difficulty,
  status = excluded.status;

-- ── 3. Insert Images Matching Your Uploaded Storage Filenames ─
insert into public.listing_images (id, listing_id, url, alt_text, sort_order) values
  (
    'b0000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    'https://qkyvscdmersaggtytmxr.supabase.co/storage/v1/object/public/listing-images/beginner-scuba-diving-introduction.jpg',
    'Beginner Scuba Diving Introduction in clear blue waters',
    0
  ),
  (
    'b0000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000002',
    'https://qkyvscdmersaggtytmxr.supabase.co/storage/v1/object/public/listing-images/advanced-reef-diving-expedition.jpg',
    'Advanced Reef Diving Expedition exploring deep coral drop-offs',
    0
  ),
  (
    'b0000000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000003',
    'https://qkyvscdmersaggtytmxr.supabase.co/storage/v1/object/public/listing-images/guided-shore-dive.jpg',
    'Guided Shore Dive along rocky coastal formations',
    0
  ),
  (
    'b0000000-0000-0000-0000-000000000004',
    '30000000-0000-0000-0000-000000000004',
    'https://qkyvscdmersaggtytmxr.supabase.co/storage/v1/object/public/listing-images/beginner-snorkeling-adventure.jpg',
    'Beginner Snorkeling Adventure in shallow turquoise bay',
    0
  ),
  (
    'b0000000-0000-0000-0000-000000000005',
    '30000000-0000-0000-0000-000000000005',
    'https://qkyvscdmersaggtytmxr.supabase.co/storage/v1/object/public/listing-images/coral-reef-snorkeling-tour.jpg',
    'Coral Reef Snorkeling Tour with tropical reef formations',
    0
  ),
  (
    'b0000000-0000-0000-0000-000000000006',
    '30000000-0000-0000-0000-000000000006',
    'https://qkyvscdmersaggtytmxr.supabase.co/storage/v1/object/public/listing-images/guided-marine-wildlife-exploration.jpg',
    'Guided Marine Wildlife Exploration with coastal fauna',
    0
  ),
  (
    'b0000000-0000-0000-0000-000000000007',
    '30000000-0000-0000-0000-000000000007',
    'https://qkyvscdmersaggtytmxr.supabase.co/storage/v1/object/public/listing-images/island-hopping-boat-tour.jpg',
    'Island Hopping Boat Tour across secluded ocean coves',
    0
  ),
  (
    'b0000000-0000-0000-0000-000000000008',
    '30000000-0000-0000-0000-000000000008',
    'https://qkyvscdmersaggtytmxr.supabase.co/storage/v1/object/public/listing-images/sunset-ocean-cruise.jpg',
    'Sunset Ocean Cruise during golden hour over the horizon',
    0
  )
on conflict (id) do update set
  url = excluded.url,
  alt_text = excluded.alt_text;