-- Add is_available_today column to veterinarians table
ALTER TABLE public.veterinarians
  ADD COLUMN IF NOT EXISTS is_available_today boolean DEFAULT false;

-- Working schedule columns
ALTER TABLE public.veterinarians
  ADD COLUMN IF NOT EXISTS working_days text[] DEFAULT '{}';

ALTER TABLE public.veterinarians
  ADD COLUMN IF NOT EXISTS working_hours_start text DEFAULT '09:00';

ALTER TABLE public.veterinarians
  ADD COLUMN IF NOT EXISTS working_hours_end text DEFAULT '18:00';

-- Index for fast filtering on search pages
CREATE INDEX IF NOT EXISTS idx_veterinarians_available_today
  ON public.veterinarians (is_available_today)
  WHERE is_available_today = true;
