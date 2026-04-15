-- =============================================================================
-- Payments Constraint Fix — 2026-04-15
-- =============================================================================
-- Problem: payments.type CHECK constraint only allowed
--   ('subscription', 'video_consultation', 'in_person')
-- but /api/appointments/complete inserts:
--   'in_person_consultation'  (clinic appointments)
--   'emergency_consultation'  (emergency appointments)
--
-- Additionally, payments.status CHECK constraint only allowed
--   ('pending','success','failed','refunded_full','refunded_partial')
-- but the route also inserts:
--   'paid_at_clinic'  (clinic appointments paid in person)
--   'released'        (online/emergency appointments after escrow release)
--
-- Fix: drop old inline constraints, add expanded named constraints.
-- Safe to run multiple times (IF EXISTS / IF NOT EXISTS guards).
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Fix payments.type constraint
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- Drop old constraint if it exists (inline constraints get auto-named)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'payments'
      AND constraint_name = 'payments_type_check'
      AND constraint_type = 'CHECK'
  ) THEN
    ALTER TABLE public.payments DROP CONSTRAINT payments_type_check;
  END IF;

  -- Add expanded constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'payments'
      AND constraint_name = 'payments_type_check_v2'
      AND constraint_type = 'CHECK'
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_type_check_v2
      CHECK (type IN (
        'subscription',
        'video_consultation',
        'in_person',
        'in_person_consultation',
        'emergency_consultation'
      ));
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Fix payments.status constraint
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- Drop old constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'payments'
      AND constraint_name = 'payments_status_check'
      AND constraint_type = 'CHECK'
  ) THEN
    ALTER TABLE public.payments DROP CONSTRAINT payments_status_check;
  END IF;

  -- Add expanded constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'payments'
      AND constraint_name = 'payments_status_check_v2'
      AND constraint_type = 'CHECK'
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_status_check_v2
      CHECK (status IN (
        'pending',
        'success',
        'failed',
        'refunded_full',
        'refunded_partial',
        'paid_at_clinic',
        'released'
      ));
  END IF;
END $$;
