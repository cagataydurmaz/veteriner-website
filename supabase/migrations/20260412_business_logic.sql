-- ============================================================================
-- VetBul MVP — Business Logic, Legal & Financial DB Changes
-- Date: 2026-04-12
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 1A: KVKK columns on public.users
-- Stores explicit consent timestamp for KVKK compliance (Law No. 6698)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_kvkk_approved   boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS kvkk_approved_at   timestamptz DEFAULT NULL;

-- Partial index for compliance queries
CREATE INDEX IF NOT EXISTS idx_users_kvkk_approved
  ON public.users (kvkk_approved_at)
  WHERE is_kvkk_approved = true;


-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 1B: legal_consent_logs — IP + timestamp at booking time
-- Required for dispute resolution under Turkish Consumer Law (6502)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.legal_consent_logs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  appointment_id  uuid        REFERENCES public.appointments(id) ON DELETE SET NULL,
  event_type      text        NOT NULL DEFAULT 'appointment_booking'
                              CHECK (event_type IN (
                                'appointment_booking',
                                'kvkk_consent',
                                'mss_acceptance',
                                'cancellation',
                                'refund_request'
                              )),
  ip_address      text        NOT NULL,
  user_agent      text,
  extra_data      jsonb       DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.legal_consent_logs ENABLE ROW LEVEL SECURITY;

-- Users can only read their own logs
CREATE POLICY "Users read own consent logs"
  ON public.legal_consent_logs FOR SELECT
  USING (user_id = auth.uid());

-- Service role writes (bookings, cancellations happen via service key)
CREATE POLICY "Service role insert consent logs"
  ON public.legal_consent_logs FOR INSERT
  WITH CHECK (true);   -- enforced at API layer; service role bypasses RLS

-- Admin full access
CREATE POLICY "Admin all consent logs"
  ON public.legal_consent_logs
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

CREATE INDEX IF NOT EXISTS idx_legal_consent_logs_user
  ON public.legal_consent_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_legal_consent_logs_appointment
  ON public.legal_consent_logs (appointment_id)
  WHERE appointment_id IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 3: Refund tracking on appointments
-- Law 6502 requires refund amounts and status to be persisted
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS refund_status  text
    CHECK (refund_status IN ('none', 'full', 'partial', 'pending', 'failed'))
    DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS refund_amount  numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancelled_by  text
    CHECK (cancelled_by IN ('owner', 'vet', 'admin', 'system'))
    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cancelled_at   timestamptz DEFAULT NULL;

-- Index for refund-pending admin dashboard queries
CREATE INDEX IF NOT EXISTS idx_appointments_refund_pending
  ON public.appointments (refund_status)
  WHERE refund_status = 'pending';


-- ─────────────────────────────────────────────────────────────────────────────
-- DB-level trigger: prevent booking unverified vet (defence in depth)
-- The API already checks is_verified=true but a DB trigger is the last line.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_guard_unverified_vet_booking()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_verified boolean;
BEGIN
  SELECT is_verified INTO v_verified
  FROM public.veterinarians WHERE id = NEW.vet_id;

  IF v_verified IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Veteriner onaylı değil — randevu oluşturulamaz (vet_id: %)', NEW.vet_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_unverified_vet ON public.appointments;
CREATE TRIGGER trg_guard_unverified_vet
  BEFORE INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_unverified_vet_booking();


-- ─────────────────────────────────────────────────────────────────────────────
-- DB-level trigger: prevent review on non-completed appointment
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_guard_review_completed()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status FROM public.appointments WHERE id = NEW.appointment_id;
  IF v_status IS DISTINCT FROM 'completed' THEN
    RAISE EXCEPTION 'Yorum yalnızca tamamlanmış randevular için eklenebilir (status: %)', v_status;
  END IF;
  RETURN NEW;
END;
$$;

-- Only create trigger if reviews table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reviews' AND table_schema = 'public') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_guard_review_completed ON public.reviews';
    EXECUTE 'CREATE TRIGGER trg_guard_review_completed
               BEFORE INSERT ON public.reviews
               FOR EACH ROW EXECUTE FUNCTION public.fn_guard_review_completed()';
  END IF;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- Diplomas bucket: ensure private + admin-only read policy
-- (bucket already exists as private; this adds the admin-read policy)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- Ensure bucket is private
  UPDATE storage.buckets SET public = false WHERE id = 'diplomas';

  -- Add admin-read policy if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
      AND policyname = 'Admin read diplomas'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "Admin read diplomas"
        ON storage.objects FOR SELECT
        USING (
          bucket_id = 'diplomas'
          AND EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
          )
        )
    $pol$;
  END IF;
END;
$$;
