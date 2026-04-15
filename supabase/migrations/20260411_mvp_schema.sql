-- =============================================================================
-- VetBul MVP Schema — Phase 2 Migration
-- Run this in Supabase SQL Editor (safe: all ADD COLUMN IF NOT EXISTS)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- APPOINTMENTS: add appointment_type, iyzico_transaction_id, escrow_status
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS appointment_type text
    CHECK (appointment_type IN ('clinic', 'online', 'emergency'))
    DEFAULT 'clinic',

  ADD COLUMN IF NOT EXISTS iyzico_transaction_id text DEFAULT NULL,

  ADD COLUMN IF NOT EXISTS escrow_status text
    CHECK (escrow_status IN ('pending', 'held', 'released', 'refunded', 'not_applicable'))
    DEFAULT 'not_applicable';

-- Backfill: map legacy type → appointment_type + escrow_status
UPDATE public.appointments
SET
  appointment_type = CASE
    WHEN type = 'video'      THEN 'online'
    WHEN type = 'in_person'  THEN 'clinic'
    ELSE 'clinic'
  END,
  escrow_status = CASE
    WHEN type = 'video' AND payment_status = 'held'      THEN 'held'
    WHEN type = 'video' AND payment_status = 'completed' THEN 'released'
    WHEN type = 'video' AND payment_status = 'refunded'  THEN 'refunded'
    WHEN type = 'video'                                  THEN 'pending'
    ELSE 'not_applicable'
  END
WHERE appointment_type IS NULL OR appointment_type = 'clinic';

-- Index for escrow queries
CREATE INDEX IF NOT EXISTS idx_appointments_escrow_status
  ON public.appointments (escrow_status)
  WHERE escrow_status IN ('held', 'pending');

-- ─────────────────────────────────────────────────────────────────────────────
-- MEDICAL RECORDS: e-Nabız style — lab results, imaging, vaccine details
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.medical_records
  ADD COLUMN IF NOT EXISTS lab_results      jsonb    DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS imaging_urls     text[]   DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS vaccine_details  jsonb    DEFAULT '[]';

-- lab_results shape:
-- [{ "test": "Tam Kan Sayımı", "result": "Normal", "unit": "", "ref_range": "...", "date": "2026-04-11" }]

-- vaccine_details shape:
-- [{ "vaccine_name": "Kuduz", "given_date": "2026-01-15", "next_due": "2027-01-15", "batch_no": "..." }]

-- imaging_urls: array of Supabase Storage public URLs for X-rays, ultrasound etc.

-- ─────────────────────────────────────────────────────────────────────────────
-- AVAILABILITY SLOTS: add slot duration for flexibility
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.availability_slots
  ADD COLUMN IF NOT EXISTS slot_duration_minutes integer DEFAULT 30
    CHECK (slot_duration_minutes IN (15, 30, 45, 60));

-- ─────────────────────────────────────────────────────────────────────────────
-- VETERINARIANS: platform commission rate per vet (override default 15%)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.veterinarians
  ADD COLUMN IF NOT EXISTS commission_rate_pct integer DEFAULT 15
    CHECK (commission_rate_pct BETWEEN 0 AND 50);

-- ─────────────────────────────────────────────────────────────────────────────
-- PAYMENTS: add platform_commission + vet_payout columns
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS platform_commission numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vet_payout          numeric(10,2) DEFAULT 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- SYMPTOM CHECKS: make urgency_level nullable (educational-only, no triage)
-- ─────────────────────────────────────────────────────────────────────────────
-- urgency_level is already nullable in existing schema — nothing to change.
-- Adding a note column for future vet annotations on AI-generated advice.
ALTER TABLE public.symptom_checks
  ADD COLUMN IF NOT EXISTS vet_annotation text DEFAULT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- FRAUD FLAGS: add admin_notes for manual review workflow
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.fraud_flags
  ADD COLUMN IF NOT EXISTS admin_notes text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.users(id) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz DEFAULT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — extend existing policies for new columns (they inherit from table RLS)
-- No new tables added — existing RLS covers new columns automatically.
-- ─────────────────────────────────────────────────────────────────────────────

-- Confirm migration
DO $$
BEGIN
  RAISE NOTICE 'VetBul MVP migration complete.';
  RAISE NOTICE 'New columns: appointments.(appointment_type, iyzico_transaction_id, escrow_status)';
  RAISE NOTICE 'New columns: medical_records.(lab_results, imaging_urls, vaccine_details)';
  RAISE NOTICE 'New columns: availability_slots.(slot_duration_minutes)';
  RAISE NOTICE 'New columns: veterinarians.(commission_rate_pct)';
  RAISE NOTICE 'New columns: payments.(platform_commission, vet_payout)';
END $$;
