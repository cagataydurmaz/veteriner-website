-- =============================================================================
-- Edge Case Hardening: 3 Critical Fixes
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 1: Double Booking Race Condition — DB-level guard
--
-- Ensures no two ACTIVE appointments can share the same (vet, slot) even if
-- two API requests arrive in the same millisecond.
-- Error code 23505 (unique_violation) is caught and user-friendlified by the
-- API route.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS appointments_vet_slot_unique
  ON public.appointments (vet_id, datetime)
  WHERE status IN ('pending', 'confirmed');

COMMENT ON INDEX appointments_vet_slot_unique IS
  'DB-level double-booking guard. One active appointment per (vet, datetime).
   Only active (pending/confirmed) — cancelled/completed slots are reusable.
   API handles 23505 with a user-friendly message.';

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 2: Timezone Consistency Audit View
--
-- This view shows any appointments stored without an explicit timezone offset
-- (potential legacy data from before the +03:00 fix). Run this query to
-- identify affected rows and correct them manually if needed.
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT id, vet_id, datetime, created_at
-- FROM public.appointments
-- WHERE datetime AT TIME ZONE 'UTC' != datetime AT TIME ZONE 'Europe/Istanbul'
-- ORDER BY created_at DESC
-- LIMIT 50;

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 3: Retroactive Conflict Helper Function
--
-- get_conflicting_appointments(p_vet_id, p_date, p_start, p_end)
-- Returns the count of active appointments that overlap with the given window.
-- Called internally by the blocked-slots API route before inserting.
--
-- Having this as a DB function allows atomic read+write in future if needed.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_conflicting_appointments(
  p_vet_id  uuid,
  p_start   timestamptz,
  p_end     timestamptz
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COUNT(*)::integer
  FROM public.appointments
  WHERE vet_id = p_vet_id
    AND status IN ('pending', 'confirmed')
    AND datetime >= p_start
    AND datetime <  p_end;
$$;

GRANT EXECUTE ON FUNCTION public.get_conflicting_appointments(uuid, timestamptz, timestamptz)
  TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFICATION QUERIES — run after applying this migration
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Confirm the unique index exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'appointments'
  AND indexname = 'appointments_vet_slot_unique';

-- 2. Confirm the helper function exists
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name = 'get_conflicting_appointments';
