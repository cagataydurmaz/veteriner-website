-- ══════════════════════════════════════════════════════════════════════════════
-- Migration: Appointment history log + Vet documents
-- ══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- 1. APPOINTMENT HISTORY LOG
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.appointment_history (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id  UUID        NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  old_status      TEXT,
  new_status      TEXT        NOT NULL,
  changed_by      UUID        REFERENCES public.users(id),
  changed_by_role TEXT,
  reason          TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_apt_history_appointment
  ON public.appointment_history (appointment_id, created_at DESC);

-- Auto-log trigger: fires on every appointment status change
CREATE OR REPLACE FUNCTION public.log_appointment_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.appointment_history
      (appointment_id, old_status, new_status, created_at)
    VALUES
      (NEW.id, OLD.status, NEW.status, now());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS appointment_status_change ON public.appointments;

CREATE TRIGGER appointment_status_change
  AFTER UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.log_appointment_change();

-- RLS for appointment_history
ALTER TABLE public.appointment_history ENABLE ROW LEVEL SECURITY;

-- Owners can view history for their own appointments
CREATE POLICY "Owner views own appointment history"
  ON public.appointment_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = appointment_id
        AND a.owner_id = auth.uid()
    )
  );

-- Vets can view history for appointments assigned to them
CREATE POLICY "Vet views own appointment history"
  ON public.appointment_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      JOIN public.veterinarians v ON v.id = a.vet_id
      WHERE a.id = appointment_id
        AND v.user_id = auth.uid()
    )
  );

-- Admins can view all history
CREATE POLICY "Admin views all appointment history"
  ON public.appointment_history FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ─────────────────────────────────────────────
-- 2. VET DOCUMENTS
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.vet_documents (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vet_id        UUID        NOT NULL REFERENCES public.veterinarians(id) ON DELETE CASCADE,
  document_type TEXT        NOT NULL CHECK (document_type IN ('diploma', 'oda_kayit', 'kimlik', 'sertifika')),
  document_url  TEXT        NOT NULL,
  is_verified   BOOLEAN     DEFAULT false,
  admin_note    TEXT,
  uploaded_at   TIMESTAMPTZ DEFAULT now(),
  verified_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_vet_documents_vet
  ON public.vet_documents (vet_id, document_type);

ALTER TABLE public.vet_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vet manages own documents"
  ON public.vet_documents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.veterinarians v
      WHERE v.id = vet_id
        AND v.user_id = auth.uid()
    )
  );

CREATE POLICY "Admin manages documents"
  ON public.vet_documents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
