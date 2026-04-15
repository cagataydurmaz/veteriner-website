-- ══════════════════════════════════════════════════════════════════════════════
-- Fix: veterinarians table RLS — vet profile save (upsert) was blocked
--
-- Root cause: multiple migrations created/dropped overlapping policies, leaving
-- the effective policy set ambiguous. This migration wipes all existing
-- veterinarians policies and replaces them with three clear, non-overlapping rules.
--
-- Run this in Supabase SQL editor to apply.
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Make sure RLS is on
ALTER TABLE public.veterinarians ENABLE ROW LEVEL SECURITY;

-- 2. Drop every policy that might exist (names from all previous migrations)
DROP POLICY IF EXISTS "Public read verified vets"        ON public.veterinarians;
DROP POLICY IF EXISTS "Public reads verified vets"       ON public.veterinarians;
DROP POLICY IF EXISTS "Vet read own"                     ON public.veterinarians;
DROP POLICY IF EXISTS "Vet reads own profile"            ON public.veterinarians;
DROP POLICY IF EXISTS "Vet update own"                   ON public.veterinarians;
DROP POLICY IF EXISTS "Vet updates own profile"          ON public.veterinarians;
DROP POLICY IF EXISTS "Vet insert own"                   ON public.veterinarians;
DROP POLICY IF EXISTS "Vet insert own profile"           ON public.veterinarians;
DROP POLICY IF EXISTS "Vet manages own profile"          ON public.veterinarians;
DROP POLICY IF EXISTS "Vet full access own profile"      ON public.veterinarians;
DROP POLICY IF EXISTS "vet_select_own_profile"           ON public.veterinarians;
DROP POLICY IF EXISTS "vet_update_own_profile"           ON public.veterinarians;
DROP POLICY IF EXISTS "vet_insert_own_profile"           ON public.veterinarians;
DROP POLICY IF EXISTS "Admin reads all vets"             ON public.veterinarians;
DROP POLICY IF EXISTS "Admin updates vets"               ON public.veterinarians;
DROP POLICY IF EXISTS "Admin full access vets"           ON public.veterinarians;

-- 3. POLICY 1 — Public can read verified profiles (and vet can read their own even if unverified)
CREATE POLICY "vets_public_read"
  ON public.veterinarians
  FOR SELECT
  USING (
    is_verified = true
    OR user_id = auth.uid()
  );

-- 4. POLICY 2 — Vet can INSERT / UPDATE / DELETE their own row
--    Both USING (which row to touch) and WITH CHECK (what the new row must look like)
--    are anchored to auth.uid() = user_id, so upsert is fully covered.
CREATE POLICY "vets_owner_write"
  ON public.veterinarians
  FOR ALL
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. POLICY 3 — Admin can read and update any vet (for approval workflow)
CREATE POLICY "vets_admin_all"
  ON public.veterinarians
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
