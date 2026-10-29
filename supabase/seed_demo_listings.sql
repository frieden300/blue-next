-- ============================================================
-- PROJECT BLUE — Demo Marketplace Seed Data (Gear & Rentals)
-- File: supabase/seed_demo_listings.sql
-- ============================================================

-- ── Step 1: Insert demo user into auth.users ─────────────────
insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
)
values (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'demo-partner@blueproject.local',
  '',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"display_name":"Blue Demo Partner"}',
  false,
  '',
  '',
  '',
  ''
)
on conflict (id) do nothing;

-- Ensure profile exists
insert into public.profiles (id, display_name)
values ('00000000-0000-0000-0000-000000000001', 'Blue Demo Partner')
on conflict (id) do nothing;

-- ── Step 2: Create demo partner profile ──────────────────────
insert into public.partner_profiles (
  id,
  user_id,
  business_name,
  description,
  location,
  logo_url,
  verified,
  service_types
)
values (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  'Blue Expeditions',
  'Certified marine equipment supplier and dive operator serving premium ocean expeditions worldwide.',
  'Goa, India',
  null,
  true,
  array['experience', 'sell', 'rent']
)
on conflict (id) do update set
  verified = true,
  service_types = array['experience', 'sell', 'rent'];

-- ── Step 3: Gear listings (category = 'gear') ────────────────
insert into public.listings (
  id, partner_id, category, subcategory, title, description, location, price_from, difficulty, status
) values
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000010',
    'gear',
    'computers',
    'Cressi Matrix Dive Computer',
    'Air/Nitrox wrist dive computer with full-dot matrix display. Supports up to 50% O₂ nitrox mixes. Features logbook memory for 60 dives, PC interface, and backlighting. Ideal for recreational and technical divers.',
    'Goa, India',
    18500.00,
    'intermediate',
    'active'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000010',
    'gear',
    'masks',
    'Mares X-Vision Diving Mask',
    'Wide-angle single-lens diving mask with tempered glass and hypoallergenic silicone skirt. Low-volume design for easy clearing. Anti-fog treated. Available in multiple frame colours. EN 1809 certified.',
    'Goa, India',
    3200.00,
    'beginner',
    'active'
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000010',
    'gear',
    'fins',
    'Scubapro Seawing Nova Fins',
    'Award-winning split-fin design engineered for maximum thrust with minimum effort. Pivoting blade flexes to match the diver''s kick cycle. Corrosion-resistant stainless steel spring strap. Full-foot and open-heel variants available.',
    'Goa, India',
    8750.00,
    'beginner',
    'active'
  ),
  (
    '10000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000010',
    'gear',
    'wetsuits',
    'Aqua Lung Dimension 5mm Wetsuit',
    'Premium 5mm neoprene wetsuit with Titanium thermal lining for superior warmth. YKK back zip, reinforced knees and elbows, and anatomical pre-bent arms and legs for a comfortable fit in warm and tropical waters.',
    'Goa, India',
    14200.00,
    'beginner',
    'active'
  ),
  (
    '10000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000010',
    'gear',
    'regulators',
    'Scubapro MK25 EVO / A700 Regulator',
    'High-performance regulator system with balanced diaphragm first stage and balanced downstream second stage. Ultra-light titanium components, chromed brass barrel, and unmatched breathing performance at any depth and temperature.',
    'Goa, India',
    42000.00,
    'advanced',
    'active'
  ),
  (
    '10000000-0000-0000-0000-000000000006',
    '00000000-0000-0000-0000-000000000010',
    'gear',
    'masks',
    'Cressi Corsica Snorkel Set',
    'Complete snorkel set including tempered glass mask, dry-top snorkel with purge valve, and open-heel adjustable fins with quick-release buckles. Packaged in a carry-mesh bag. Perfect for snorkeling, freediving, and surface swimming.',
    'Goa, India',
    2800.00,
    'beginner',
    'active'
  )
on conflict (id) do update set
  subcategory = excluded.subcategory,
  title = excluded.title,
  description = excluded.description,
  price_from = excluded.price_from,
  difficulty = excluded.difficulty,
  status = excluded.status;

-- ── Step 4: Rental listings (category = 'rental') ────────────
insert into public.listings (
  id, partner_id, category, subcategory, title, description, location, price_from, difficulty, status
) values
  (
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000010',
    'rental',
    'kits',
    'Complete Scuba Dive Kit (BCD + Reg + Wetsuit)',
    'All-in-one rental package including a jacket-style BCD, regulator with gauges, 5mm wetsuit, mask, fins, and booties. Sanitized and hydrostatic-tested before each rental. Valid certification required at pickup. Available in all sizes.',
    'Goa, India',
    1800.00,
    'beginner',
    'active'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000010',
    'rental',
    'cameras',
    'GoPro Hero 12 Underwater Camera',
    'Waterproof to 10m with included dome underwater housing rated to 45m. Shoots 5.3K video and 27MP stills. Package includes camera, housing, two spare batteries, 64GB card, and red filter for colour correction at depth.',
    'Goa, India',
    950.00,
    'beginner',
    'active'
  ),
  (
    '20000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000010',
    'rental',
    'tanks',
    'Aluminium 12L Dive Cylinder (Air / Nitrox)',
    'Standard 12-litre 200-bar aluminium cylinder. Available filled with air or up to 32% Nitrox (surcharge applies). Includes first-stage dust cap, valve spanner, and transport boot. VIP and hydrostatic inspection current.',
    'Goa, India',
    450.00,
    'intermediate',
    'active'
  ),
  (
    '20000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000010',
    'rental',
    'scooters',
    'Sea Scooter DPV — Diver Propulsion Vehicle',
    'EVO underwater scooter with 70 minutes run time at max thrust (2 knots). Lithium battery charged on-site, 40m depth rating. Ideal for drift dives, wide-area surveys, and photography. Briefing included with each rental.',
    'Goa, India',
    2500.00,
    'advanced',
    'active'
  )
on conflict (id) do update set
  subcategory = excluded.subcategory,
  title = excluded.title,
  description = excluded.description,
  price_from = excluded.price_from,
  difficulty = excluded.difficulty,
  status = excluded.status;

-- ── Step 5: Images pointing to Supabase Storage ──────────────
insert into public.listing_images (id, listing_id, url, alt_text, sort_order) values
  -- GEAR (FOR SALE)
  ('a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   'https://qkyvscdmersaggtytmxr.supabase.co/storage/v1/object/public/listing-images/cressi-matrix-dive-computer.jpg',
   'Cressi Matrix Dive Computer', 0),

  ('a0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002',
   'https://qkyvscdmersaggtytmxr.supabase.co/storage/v1/object/public/listing-images/mares-x-vision-diving-mask.webp',
   'Mares X-Vision Diving Mask', 0),

  ('a0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003',
   'https://qkyvscdmersaggtytmxr.supabase.co/storage/v1/object/public/listing-images/scubapro-seawing-nova-fins.webp',
   'Scubapro Seawing Nova Fins', 0),

  ('a0000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004',
   'https://qkyvscdmersaggtytmxr.supabase.co/storage/v1/object/public/listing-images/aqua-lung-dimension-5mm-wetsuit.jpg',
   'Aqua Lung Dimension 5mm Wetsuit', 0),

  ('a0000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000005',
   'https://qkyvscdmersaggtytmxr.supabase.co/storage/v1/object/public/listing-images/scubapro-mk25-evo-a700-regulator.jpg',
   'Scubapro MK25 EVO-A700 Regulator', 0),

  ('a0000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000006',
   'https://qkyvscdmersaggtytmxr.supabase.co/storage/v1/object/public/listing-images/cressi-corsica-snorkel-set.jpg',
   'Cressi Corsica Snorkel Set', 0),

  -- RENTALS
  ('a0000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000001',
   'https://qkyvscdmersaggtytmxr.supabase.co/storage/v1/object/public/listing-images/complete-scuba-dive-kit-renta.jpg',
   'Complete Scuba Dive Kit Rental', 0),

  ('a0000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000002',
   'https://qkyvscdmersaggtytmxr.supabase.co/storage/v1/object/public/listing-images/gopro-hero-12-underwater-camera-rental.webp',
   'GoPro Hero 12 Underwater Camera Rental', 0),

  ('a0000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000003',
   'https://qkyvscdmersaggtytmxr.supabase.co/storage/v1/object/public/listing-images/aluminium-12l-dive-cylinder-rental.webp',
   'Aluminium 12L Dive Cylinder Rental', 0),

  ('a0000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000004',
   'https://qkyvscdmersaggtytmxr.supabase.co/storage/v1/object/public/listing-images/sea-scooter-dpv-rental.webp',
   'Sea Scooter DPV Rental', 0)
on conflict (id) do update set
  url = excluded.url,
  alt_text = excluded.alt_text;