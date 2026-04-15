-- =============================================================================
-- Schedule Enhancements
-- 1. Add service_type to availability_slots (clinic / video / both)
-- 2. Add slot_duration_minutes if missing
-- 3. Create blocked_slots table (one-off exceptions: lunch, surgery, vacation)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. availability_slots: add service_type + slot_duration_minutes
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.availability_slots
  ADD COLUMN IF NOT EXISTS service_type       text NOT NULL DEFAULT 'both'
    CHECK (service_type IN ('clinic', 'video', 'both')),
  ADD COLUMN IF NOT EXISTS slot_duration_minutes integer NOT NULL DEFAULT 30
    CHECK (slot_duration_minutes IN (15, 30, 45, 60));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. blocked_slots: vet can block specific date/time windows
--    e.g. every day lunch 12:00-13:00, or Dec 25 all day
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.blocked_slots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vet_id      uuid NOT NULL REFERENCES public.veterinarians(id) ON DELETE CASCADE,
  blocked_date date NOT NULL,
  start_time  time,           -- NULL = full day block
  end_time    time,           -- NULL = full day block
  reason      text,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blocked_slots_vet_date
  ON public.blocked_slots (vet_id, blocked_date);

-- RLS
ALTER TABLE public.blocked_slots ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'blocked_slots' AND policyname = 'Vet manages own blocked slots'
  ) THEN
    CREATE POLICY "Vet manages own blocked slots"
      ON public.blocked_slots FOR ALL
      USING (
        vet_id IN (
          SELECT id FROM public.veterinarians WHERE user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'blocked_slots' AND policyname = 'Public reads blocked slots'
  ) THEN
    CREATE POLICY "Public reads blocked slots"
      ON public.blocked_slots FOR SELECT USING (true);
  END IF;
END $$;
