-- =============================================================================
-- Test Seed: 3 Canonical Vet Profiles for 3-Layer State Machine Testing
-- =============================================================================
-- Prerequisites: 20260412_3layer_state_machine.sql must be applied first.
--
-- Profile 1 — "Mükemmel Veteriner" (The Perfect Vet)
--   Verified ✓ | All Layer 1 permissions ON | Layer 2: online + available + on-call
--   is_busy=false | buffer_lock=false
--   → Must appear on all 3 public listing pages
--
-- Profile 2 — "Meşgul Veteriner" (The Busy Vet)
--   Verified ✓ | All Layer 1 permissions ON | Active appointment in 10 min window
--   buffer_lock=true (set by compute_buffer_lock after appointment insert)
--   → Must NOT appear on online/nobetci pages; visible on klinikte (buffer_lock
--     is not a filter there — physical exam is already at the clinic)
--
-- Profile 3 — "Kısıtlı Veteriner" (The Restricted Vet)
--   Verified ✓ | offers_video=false | is_online_now=false
--   → Must appear on klinikte; must NOT appear on online page (Layer 1 blocks)
--   → UI must show 🔒 lock on OnlineToggle in vet dashboard
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 0: Helper — ensure auth.users rows exist, then upsert public.users
-- ─────────────────────────────────────────────────────────────────────────────
-- We use fixed UUIDs so this script is idempotent (safe to re-run).

DO $$
DECLARE
  v_perfect_user_id  uuid := 'aaaaaaaa-0001-0001-0001-000000000001';
  v_busy_user_id     uuid := 'aaaaaaaa-0002-0002-0002-000000000002';
  v_restricted_user_id uuid := 'aaaaaaaa-0003-0003-0003-000000000003';
BEGIN

  -- ── Create auth.users rows ──────────────────────────────────────────────
  -- Using email/password = test+perfectvet@veterineribul.com / Test1234!
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_user_meta_data, is_super_admin, confirmation_token,
    recovery_token, email_change_token_new, email_change
  ) VALUES
  (
    v_perfect_user_id, '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'test+perfectvet@veterineribul.com',
    crypt('Test1234!', gen_salt('bf')),
    now(), now(), now(),
    '{"full_name": "Dr. Mükemmel Yılmaz"}'::jsonb,
    false, '', '', '', ''
  ),
  (
    v_busy_user_id, '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'test+busyvet@veterineribul.com',
    crypt('Test1234!', gen_salt('bf')),
    now(), now(), now(),
    '{"full_name": "Dr. Meşgul Kaya"}'::jsonb,
    false, '', '', '', ''
  ),
  (
    v_restricted_user_id, '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'test+restrictedvet@veterineribul.com',
    crypt('Test1234!', gen_salt('bf')),
    now(), now(), now(),
    '{"full_name": "Dr. Kısıtlı Demir"}'::jsonb,
    false, '', '', '', ''
  )
  ON CONFLICT (id) DO NOTHING;

  -- ── Upsert public.users ─────────────────────────────────────────────────
  INSERT INTO public.users (id, email, full_name, role, phone, created_at)
  VALUES
  (
    v_perfect_user_id,
    'test+perfectvet@veterineribul.com',
    'Dr. Mükemmel Yılmaz',
    'vet',
    '+905550000001',
    now()
  ),
  (
    v_busy_user_id,
    'test+busyvet@veterineribul.com',
    'Dr. Meşgul Kaya',
    'vet',
    '+905550000002',
    now()
  ),
  (
    v_restricted_user_id,
    'test+restrictedvet@veterineribul.com',
    'Dr. Kısıtlı Demir',
    'vet',
    '+905550000003',
    now()
  )
  ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        role      = EXCLUDED.role;

END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: Profile 1 — The Perfect Vet
-- Layer 1: all 3 services ON
-- Layer 2: available today + online now + on-call
-- Layer 3: not busy, no buffer lock, fresh heartbeat
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.veterinarians (
  id,
  user_id,
  specialty,
  city,
  district,
  bio,
  subscription_tier,
  is_verified,
  is_demo,
  -- fees
  consultation_fee,
  video_consultation_fee,
  nobetci_fee,
  -- Layer 1: permissions
  offers_in_person,
  offers_video,
  offers_nobetci,
  -- Layer 2: intent
  is_available_today,
  is_online_now,
  is_on_call,
  -- Layer 3: reality
  is_busy,
  buffer_lock,
  heartbeat_at,
  -- ratings
  average_rating,
  total_reviews,
  created_at
) VALUES (
  'bbbbbbbb-0001-0001-0001-000000000001',
  'aaaaaaaa-0001-0001-0001-000000000001',
  'Genel Pratisyen',
  'İstanbul',
  'Kadıköy',
  'Test profili — tüm hizmetler aktif, sistem testleri için kullanılır.',
  'pro',
  true,   -- is_verified
  true,   -- is_demo
  -- fees
  300,
  400,
  600,
  -- Layer 1: all ON
  true,   -- offers_in_person
  true,   -- offers_video
  true,   -- offers_nobetci
  -- Layer 2: all ON (active intent)
  true,   -- is_available_today
  true,   -- is_online_now
  true,   -- is_on_call
  -- Layer 3: clean state
  false,  -- is_busy
  false,  -- buffer_lock
  now(),  -- heartbeat_at (fresh — won't be killed by offline cron)
  4.9,
  42,
  now()
)
ON CONFLICT (id) DO UPDATE SET
  specialty           = EXCLUDED.specialty,
  is_verified         = EXCLUDED.is_verified,
  offers_in_person    = EXCLUDED.offers_in_person,
  offers_video        = EXCLUDED.offers_video,
  offers_nobetci      = EXCLUDED.offers_nobetci,
  is_available_today  = EXCLUDED.is_available_today,
  is_online_now       = EXCLUDED.is_online_now,
  is_on_call          = EXCLUDED.is_on_call,
  is_busy             = EXCLUDED.is_busy,
  buffer_lock         = EXCLUDED.buffer_lock,
  heartbeat_at        = EXCLUDED.heartbeat_at;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: Profile 2 — The Busy Vet (buffer_lock test)
-- Layer 1: all 3 services ON
-- Layer 2: available + online + on-call (all intent ON)
-- Layer 3: buffer_lock=true because appointment is 10 min from now
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.veterinarians (
  id, user_id, specialty, city, district, bio,
  subscription_tier, is_verified, is_demo,
  consultation_fee, video_consultation_fee, nobetci_fee,
  offers_in_person, offers_video, offers_nobetci,
  is_available_today, is_online_now, is_on_call,
  is_busy, buffer_lock, heartbeat_at,
  average_rating, total_reviews, created_at
) VALUES (
  'bbbbbbbb-0002-0002-0002-000000000002',
  'aaaaaaaa-0002-0002-0002-000000000002',
  'Küçük Hayvanlar',
  'Ankara',
  'Çankaya',
  'Test profili — buffer_lock aktif, yaklaşan klinikte randevusu var.',
  'basic',
  true,
  true,
  250, 350, 500,
  -- Layer 1: all ON
  true, true, true,
  -- Layer 2: all ON
  true, true, true,
  -- Layer 3: buffer_lock active (appointment coming up)
  false,  -- is_busy=false (not IN a session, just approaching one)
  true,   -- buffer_lock=true ← KEY: this blocks online/nobetci
  now(),
  4.5, 18, now()
)
ON CONFLICT (id) DO UPDATE SET
  specialty          = EXCLUDED.specialty,
  is_verified        = EXCLUDED.is_verified,
  offers_in_person   = EXCLUDED.offers_in_person,
  offers_video       = EXCLUDED.offers_video,
  offers_nobetci     = EXCLUDED.offers_nobetci,
  is_available_today = EXCLUDED.is_available_today,
  is_online_now      = EXCLUDED.is_online_now,
  is_on_call         = EXCLUDED.is_on_call,
  is_busy            = EXCLUDED.is_busy,
  buffer_lock        = EXCLUDED.buffer_lock,
  heartbeat_at       = EXCLUDED.heartbeat_at;

-- Insert the upcoming clinic appointment that caused the buffer_lock
-- (10 minutes from now — inside the ±30 min window)
INSERT INTO public.appointments (
  id,
  vet_id,
  owner_id,
  pet_id,
  appointment_type,
  status,
  datetime,
  notes,
  created_at
)
SELECT
  'cccccccc-0002-0002-0002-000000000002',
  'bbbbbbbb-0002-0002-0002-000000000002',
  -- Use the first real owner from the DB as a placeholder owner
  (SELECT id FROM public.users WHERE role = 'owner' LIMIT 1),
  -- Use the first real pet
  (SELECT id FROM public.pets LIMIT 1),
  'clinic',
  'confirmed',
  now() + INTERVAL '10 minutes',
  'Buffer lock test appointment — auto-created by seed script',
  now()
WHERE
  -- Only insert if a real owner and pet exist; skip if DB is empty
  EXISTS (SELECT 1 FROM public.users WHERE role = 'owner' LIMIT 1)
  AND EXISTS (SELECT 1 FROM public.pets LIMIT 1)
ON CONFLICT (id) DO UPDATE SET
  datetime = now() + INTERVAL '10 minutes',
  status   = 'confirmed';

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: Profile 3 — The Restricted Vet (Layer 1 lock test)
-- Layer 1: offers_in_person=true, offers_video=FALSE, offers_nobetci=false
-- Layer 2: is_available_today=true (can appear on klinikte)
--          is_online_now=false (no video permission, not online)
-- Layer 3: clean
-- Expected UI: OnlineToggle shows 🔒, OnCallToggle shows 🔒
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.veterinarians (
  id, user_id, specialty, city, district, bio,
  subscription_tier, is_verified, is_demo,
  consultation_fee, video_consultation_fee, nobetci_fee,
  offers_in_person, offers_video, offers_nobetci,
  is_available_today, is_online_now, is_on_call,
  is_busy, buffer_lock, heartbeat_at,
  average_rating, total_reviews, created_at
) VALUES (
  'bbbbbbbb-0003-0003-0003-000000000003',
  'aaaaaaaa-0003-0003-0003-000000000003',
  'Egzotik Hayvanlar',
  'İzmir',
  'Bornova',
  'Test profili — sadece klinikte muayene açık; video/nöbetçi profilde kapalı.',
  'free',
  true,
  true,
  200, 0, 0,
  -- Layer 1: only in-person ON (video and nobetci locked at profile level)
  true,   -- offers_in_person
  false,  -- offers_video ← Layer 1 lock for OnlineToggle
  false,  -- offers_nobetci ← Layer 1 lock for OnCallToggle
  -- Layer 2
  true,   -- is_available_today (visible on klinikte)
  false,  -- is_online_now (cannot be true without offers_video)
  false,  -- is_on_call
  -- Layer 3: clean
  false, false, null,
  4.2, 7, now()
)
ON CONFLICT (id) DO UPDATE SET
  specialty          = EXCLUDED.specialty,
  is_verified        = EXCLUDED.is_verified,
  offers_in_person   = EXCLUDED.offers_in_person,
  offers_video       = EXCLUDED.offers_video,
  offers_nobetci     = EXCLUDED.offers_nobetci,
  is_available_today = EXCLUDED.is_available_today,
  is_online_now      = EXCLUDED.is_online_now,
  is_on_call         = EXCLUDED.is_on_call,
  is_busy            = EXCLUDED.is_busy,
  buffer_lock        = EXCLUDED.buffer_lock,
  heartbeat_at       = EXCLUDED.heartbeat_at;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4: Verification queries
-- ─────────────────────────────────────────────────────────────────────────────
-- Expected results:
--   Profile 1 → appears on: klinikte ✓ | online ✓ | nobetci ✓
--   Profile 2 → appears on: klinikte ✓ | online ✗ (buffer_lock) | nobetci ✗ (buffer_lock)
--   Profile 3 → appears on: klinikte ✓ | online ✗ (offers_video=false) | nobetci ✗ (offers_nobetci=false)

SELECT
  u.full_name,
  v.specialty,
  v.city,
  -- Layer 1
  v.offers_in_person,
  v.offers_video,
  v.offers_nobetci,
  -- Layer 2
  v.is_available_today,
  v.is_online_now,
  v.is_on_call,
  -- Layer 3
  v.is_busy,
  v.buffer_lock,
  -- Computed visibility per page
  (v.offers_in_person AND v.is_available_today)                                   AS visible_klinikte,
  (v.offers_video AND v.is_online_now AND NOT v.is_busy AND NOT v.buffer_lock)    AS visible_online,
  (v.offers_nobetci AND v.is_on_call  AND NOT v.is_busy AND NOT v.buffer_lock)    AS visible_nobetci
FROM public.veterinarians v
JOIN public.users u ON u.id = v.user_id
WHERE v.id IN (
  'bbbbbbbb-0001-0001-0001-000000000001',
  'bbbbbbbb-0002-0002-0002-000000000002',
  'bbbbbbbb-0003-0003-0003-000000000003'
)
ORDER BY v.created_at;
