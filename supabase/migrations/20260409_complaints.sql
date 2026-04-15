-- Add ban/suspend columns to users table (for owners)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS suspension_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ban_reason TEXT;

-- Add admin_note to veterinarians table
ALTER TABLE public.veterinarians
  ADD COLUMN IF NOT EXISTS admin_note TEXT;

-- Add admin_note to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS admin_note TEXT;

-- Complaints table for appointment-level disputes
CREATE TABLE IF NOT EXISTS public.complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
  reporter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  reporter_type TEXT NOT NULL CHECK (reporter_type IN ('owner','vet')),
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','under_review','resolved')),
  admin_note TEXT,
  resolution TEXT
    CHECK (resolution IN ('owner_wins','vet_wins','split','dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reporters_create_own_complaints" ON public.complaints
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "reporters_view_own_complaints" ON public.complaints
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid());

CREATE POLICY "admin_all_complaints" ON public.complaints
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_complaints_appointment_id ON public.complaints(appointment_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_reporter_id ON public.complaints(reporter_id);
