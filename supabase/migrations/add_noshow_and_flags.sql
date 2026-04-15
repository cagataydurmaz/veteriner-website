-- ============================================================
-- No-show detection + user warning system
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Add 'no_show' to appointments.status enum
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show'));

-- 2. Add warning fields to users
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS complaint text,
  ADD COLUMN IF NOT EXISTS datetime  timestamptz;

-- Backfill datetime from scheduled_at if needed
UPDATE public.appointments SET datetime = scheduled_at WHERE datetime IS NULL AND scheduled_at IS NOT NULL;

-- 3. Add user warning / flagging columns
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS warning_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_flagged   boolean DEFAULT false;

-- 4. Index for no-show cron performance
CREATE INDEX IF NOT EXISTS idx_appointments_noshow_check
  ON public.appointments (status, datetime)
  WHERE status = 'confirmed';
