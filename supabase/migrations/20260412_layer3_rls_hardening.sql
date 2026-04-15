-- =============================================================================
-- Layer 3 RLS Hardening
-- =============================================================================
--
-- Problem: The "Vet manages own profile" FOR ALL policy currently allows a vet
-- to UPDATE *any* column including Layer 3 system columns:
--   • is_busy       — must only be written by API routes (agora-token, complete)
--   • buffer_lock   — must only be written by cron (recompute-buffer-locks)
--   • heartbeat_at  — must only be written by API route (heartbeat)
--
-- A malicious or buggy client SDK call could set is_busy=false to unlock
-- themselves during an active consultation, or set buffer_lock=false to
-- bypass the 30-minute pre-appointment guard.
--
-- Fix: Replace the broad FOR ALL policy with two explicit policies:
--   1. SELECT  — vet reads own row (unchanged)
--   2. UPDATE  — vet can only write Layer 1/2 profile columns; Layer 3
--                columns are blocked via WITH CHECK.
--
-- Layer 3 writes continue to work because those API routes use the
-- service_role client (bypasses RLS entirely).
-- =============================================================================

-- ── Step 1: Drop the existing broad UPDATE/FOR ALL policy ────────────────────
-- The policy name used in RLS_COMPLETE.sql is "Vet manages own profile".
-- IF it doesn't exist the DROP is a no-op (IF EXISTS).
DROP POLICY IF EXISTS "Vet manages own profile"     ON public.veterinarians;
DROP POLICY IF EXISTS "Vets can update own profile" ON public.veterinarians;
DROP POLICY IF EXISTS "Vet can update own row"      ON public.veterinarians;

-- ── Step 2: Narrow SELECT policy (keep it simple) ────────────────────────────
-- Some setups already have a separate SELECT policy; use IF NOT EXISTS.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'veterinarians'
      AND policyname = 'Vet reads own profile'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "Vet reads own profile"
        ON public.veterinarians
        FOR SELECT
        USING (user_id = auth.uid())
    $pol$;
  END IF;
END$$;

-- ── Step 3: Narrow UPDATE policy — Layer 1/2 columns only ────────────────────
--
-- WITH CHECK enforces that the vet cannot change the Layer 3 columns.
-- Because PostgreSQL evaluates WITH CHECK against the *proposed* NEW row,
-- any attempt to change is_busy / buffer_lock / heartbeat_at from the client
-- will fail with a policy violation (RLS error code 42501).
--
-- Columns the vet IS allowed to update (Layer 1 & 2):
--   offers_video, offers_in_person, offers_nobetci
--   is_online_now, is_available_today, is_on_call
--   display_name, bio, photo_url, clinic_address, phone_number
--   video_consultation_fee, consultation_fee, nobetci_fee
--   commission_rate_pct, auto_approve_appointments
--   (all other profile metadata)
--
-- Columns the vet is NOT allowed to update (Layer 3 — system-only):
--   is_busy, buffer_lock, heartbeat_at
--
-- Implementation: USING lets the vet target their own row;
-- WITH CHECK rejects any write where the NEW row differs from the OLD row
-- on a Layer 3 column.  Because service_role bypasses RLS, cron / API routes
-- are unaffected.
CREATE POLICY "Vet updates own profile (Layer 1/2 only)"
  ON public.veterinarians
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    -- Reject if the client is trying to change a Layer 3 system column.
    -- We compare the proposed new value against the current persisted value
    -- by re-selecting the row inside the check expression.
    AND is_busy = (
      SELECT v.is_busy FROM public.veterinarians v WHERE v.id = veterinarians.id
    )
    AND buffer_lock = (
      SELECT v.buffer_lock FROM public.veterinarians v WHERE v.id = veterinarians.id
    )
    AND heartbeat_at IS NOT DISTINCT FROM (
      SELECT v.heartbeat_at FROM public.veterinarians v WHERE v.id = veterinarians.id
    )
  );

-- ── Verification ─────────────────────────────────────────────────────────────
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename  = 'veterinarians'
ORDER BY policyname;
