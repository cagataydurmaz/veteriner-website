-- =============================================================================
-- Demo vet status flags — makes demo vets visible on all three public pages
-- Run in Supabase SQL Editor
-- =============================================================================

-- First let's see what demo vets we have
-- SELECT id, full_name, specialty, city, offers_in_person, offers_video, offers_nobetci,
--        is_online_now, is_on_call, is_demo, is_verified
-- FROM public.veterinarians WHERE is_demo = true ORDER BY created_at;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 1: Make sure ALL demo vets have offers_in_person = true (Klinikte tab)
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.veterinarians
SET offers_in_person = true
WHERE is_demo = true AND is_verified = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 2: Set is_online_now = true for vets that offer video (Online tab)
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.veterinarians
SET is_online_now = true
WHERE is_demo = true
  AND is_verified = true
  AND offers_video = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 3: Set is_on_call = true for vets that offer nöbetçi (Nöbetçi tab)
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.veterinarians
SET is_on_call = true
WHERE is_demo = true
  AND is_verified = true
  AND offers_nobetci = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 4: If NO demo vet has offers_video=true, set 3 random ones online
-- (Run this only if Step 2 updated 0 rows)
-- ─────────────────────────────────────────────────────────────────────────────
-- UPDATE public.veterinarians
-- SET offers_video = true, is_online_now = true, video_consultation_fee = 350
-- WHERE id IN (
--   SELECT id FROM public.veterinarians
--   WHERE is_demo = true AND is_verified = true
--   ORDER BY RANDOM() LIMIT 3
-- );

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 5: If NO demo vet has offers_nobetci=true, set 2 random ones on-call
-- (Run this only if Step 3 updated 0 rows)
-- ─────────────────────────────────────────────────────────────────────────────
-- UPDATE public.veterinarians
-- SET offers_nobetci = true, is_on_call = true, nobetci_fee = 600
-- WHERE id IN (
--   SELECT id FROM public.veterinarians
--   WHERE is_demo = true AND is_verified = true
--   ORDER BY RANDOM() LIMIT 2
-- );

-- ─────────────────────────────────────────────────────────────────────────────
-- Verify results
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  full_name,
  specialty,
  city,
  offers_in_person,
  offers_video,
  offers_nobetci,
  is_online_now,
  is_on_call
FROM public.veterinarians
WHERE is_demo = true AND is_verified = true
ORDER BY full_name;
