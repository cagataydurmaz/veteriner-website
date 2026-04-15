-- =============================================================================
-- Layer 3 RLS Hardening — v2
-- =============================================================================
--
-- Problem discovered after v1:
--   The legacy "vets_owner_write" (FOR ALL, with_check = auth.uid() = user_id)
--   policy was still present. PostgreSQL evaluates multiple policies with OR
--   logic — if ANY policy permits the action, it succeeds. That means our new
--   narrow UPDATE policy was completely bypassed: a vet could still call the
--   client SDK to set is_busy=false or buffer_lock=false directly.
--
-- Fix:
--   1. DROP "vets_owner_write" (the broad FOR ALL policy)
--   2. Replace it with three explicit, narrow policies:
--        INSERT — vet can insert their own profile row (onboarding)
--        UPDATE — Layer 1/2 columns only (Layer 3 protected by WITH CHECK)
--        DELETE — deliberately NOT granted (profile deletion is admin-only)
--   3. Keep "vets_admin_all" as-is (admins need full access)
--   4. Keep "vets_public_read" and "Vet reads own profile" as-is (SELECT only)
-- =============================================================================

-- ── Step 1: Remove the offending broad policy ─────────────────────────────────
DROP POLICY IF EXISTS "vets_owner_write"
  ON public.veterinarians;

-- ── Step 2: Vet can INSERT their own profile row (onboarding flow) ────────────
-- Only needed once at registration; service_role also handles this in the
-- admin-created flow. Keep it here for completeness.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'veterinarians'
      AND policyname = 'Vet inserts own profile'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "Vet inserts own profile"
        ON public.veterinarians
        FOR INSERT
        WITH CHECK (auth.uid() = user_id)
    $pol$;
  END IF;
END$$;

-- ── Step 3: Narrow UPDATE policy (already created in v1, recreate idempotently)
-- Drop first to allow clean re-creation if v1 was already applied.
DROP POLICY IF EXISTS "Vet updates own profile (Layer 1/2 only)" ON public.veterinarians;

CREATE POLICY "Vet updates own profile (Layer 1/2 only)"
  ON public.veterinarians
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    -- ── Layer 3 freeze: reject any client write that changes these columns ──
    -- The sub-SELECT reads the CURRENT persisted value; WITH CHECK compares
    -- it against the proposed NEW row. If they differ, the policy rejects.
    -- service_role bypasses RLS entirely, so cron/API routes are unaffected.
    AND is_busy = (
      SELECT v.is_busy
      FROM   public.veterinarians v
      WHERE  v.id = veterinarians.id
    )
    AND buffer_lock = (
      SELECT v.buffer_lock
      FROM   public.veterinarians v
      WHERE  v.id = veterinarians.id
    )
    AND heartbeat_at IS NOT DISTINCT FROM (
      SELECT v.heartbeat_at
      FROM   public.veterinarians v
      WHERE  v.id = veterinarians.id
    )
  );

-- ── Step 4: Ensure SELECT policies exist (idempotent) ────────────────────────
-- "vets_public_read" already exists; the narrow "Vet reads own profile" from
-- v1 may or may not exist — handle both cases.
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

-- ── Verification ─────────────────────────────────────────────────────────────
-- Expected result after this migration:
--   policyname                             | cmd
--   ───────────────────────────────────────┼────────
--   Vet inserts own profile                | INSERT
--   Vet reads own profile                  | SELECT
--   Vet updates own profile (Layer 1/2 only)| UPDATE
--   vets_admin_all                         | ALL
--   vets_public_read                       | SELECT
--
-- Notice: NO "ALL" write policy for the vet — only the narrow INSERT + UPDATE.
SELECT policyname, cmd, with_check IS NOT NULL AS has_write_check
FROM   pg_policies
WHERE  schemaname = 'public'
  AND  tablename  = 'veterinarians'
ORDER  BY cmd, policyname;
