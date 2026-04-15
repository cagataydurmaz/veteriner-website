-- =============================================================================
-- Performance Indexes — Scalability for 10k+ rows
-- =============================================================================
--
-- Problem: At scale the most frequent queries hit appointments and
-- availability_slots with multi-column WHERE clauses. Without composite
-- indexes PostgreSQL must scan the full vet's row set for every scheduler
-- call, slot availability check, cron run, and booking guard.
--
-- Hottest query patterns analysed:
--
--  scheduler.ts (runs on every /slots and /availability request):
--    WHERE vet_id = $1
--      AND status IN ('pending','confirmed')
--      AND datetime >= $2 AND datetime <= $3
--
--  recompute-buffer-locks (every 5 min across ALL vets):
--    WHERE status IN ('pending','confirmed')
--      AND datetime >= $1 AND datetime <= $2
--
--  no-show-detection (every hour):
--    WHERE status = 'confirmed'
--      AND datetime < $1
--
--  availability route (every calendar load):
--    WHERE vet_id = $1
--      AND is_active = true
--
-- =============================================================================

-- ── 1. appointments: composite for per-vet slot queries ──────────────────────
--
-- Covers: scheduler.ts, book/route.ts double-booking check, buffer-lock cron.
-- Column order: vet_id first (equality) → status (low-cardinality IN) → datetime (range).
-- The existing partial unique index on (vet_id, datetime) WHERE status IN (...)
-- covers the unique constraint but NOT general range scans with status filters.
CREATE INDEX IF NOT EXISTS idx_appointments_vet_status_dt
  ON public.appointments (vet_id, status, datetime);

-- ── 2. appointments: global status+datetime for cross-vet cron queries ────────
--
-- Covers: recompute-buffer-locks (no vet_id filter), no-show-detection.
-- Without this, those crons do a full sequential scan of the appointments table.
CREATE INDEX IF NOT EXISTS idx_appointments_status_dt
  ON public.appointments (status, datetime);

-- ── 3. availability_slots: composite for scheduler template load ──────────────
--
-- Covers: scheduler.ts step 1 — "load active templates for vet".
--   WHERE vet_id = $1 AND is_active = true
-- The existing idx_availability_vet(vet_id) is a single-column index; adding
-- is_active as a second column eliminates the filter step entirely.
CREATE INDEX IF NOT EXISTS idx_availability_slots_vet_active
  ON public.availability_slots (vet_id, is_active)
  WHERE is_active = true;

-- ── 4. blocked_slots: already has idx_blocked_slots_vet_date ─────────────────
-- (created in 20260412_schedule_enhancements.sql) — no action needed.

-- ── 5. Stale blocked_slots cleanup ───────────────────────────────────────────
--
-- Blocked slots from the past accumulate indefinitely. This function is called
-- by the reset-availability cron (nightly) to prune rows older than 30 days.
-- Keeping the table lean ensures the scheduler's blocked_slots range query
-- stays fast even without an additional date index.
CREATE OR REPLACE FUNCTION public.cleanup_stale_blocked_slots()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH deleted AS (
    DELETE FROM public.blocked_slots
    WHERE blocked_date < CURRENT_DATE - INTERVAL '30 days'
    RETURNING id
  )
  SELECT COUNT(*)::integer FROM deleted;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_stale_blocked_slots() TO service_role;

-- ── 6. Stale pending appointments ────────────────────────────────────────────
--
-- Appointments in 'pending' status (auto_approve=false, vet never confirmed)
-- that are more than 48 hours past their datetime become orphaned.
-- This function marks them 'cancelled' with a system reason.
-- Call it from a cron or add to the no-show-detection run.
CREATE OR REPLACE FUNCTION public.expire_stale_pending_appointments()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH expired AS (
    UPDATE public.appointments
    SET    status = 'cancelled',
           cancellation_reason = 'Sistem: veteriner 48 saat içinde onaylamadı'
    WHERE  status = 'pending'
      AND  datetime < NOW() - INTERVAL '48 hours'
    RETURNING id
  )
  SELECT COUNT(*)::integer FROM expired;
$$;

GRANT EXECUTE ON FUNCTION public.expire_stale_pending_appointments() TO service_role;

-- ── Verification ─────────────────────────────────────────────────────────────
SELECT indexname, tablename, indexdef
FROM   pg_indexes
WHERE  tablename IN ('appointments', 'availability_slots', 'blocked_slots')
  AND  indexname LIKE 'idx_%'
ORDER  BY tablename, indexname;
