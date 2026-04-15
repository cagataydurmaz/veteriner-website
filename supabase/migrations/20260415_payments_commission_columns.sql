-- =============================================================================
-- payments: platform_commission + vet_payout kolonları
-- appointments: payment_status constraint genişletme
-- =============================================================================
-- Idempotent — birden fazla çalıştırılabilir.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. payments tablosuna komisyon kolonları ekle
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS platform_commission numeric(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS vet_payout          numeric(10,2) DEFAULT NULL;

COMMENT ON COLUMN public.payments.platform_commission IS '% komisyon tutarı (örn. tutar × 0.15)';
COMMENT ON COLUMN public.payments.vet_payout          IS 'Veterinere aktarılacak net tutar (tutar - komisyon)';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. appointments.payment_status — eksik değerleri ekle
--    Orijinal constraint: ('none','held','completed','refunded_full','refunded_partial')
--    Eklenenler: 'pending', 'processing_refund', 'failed'
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- Eski constraint'i bul ve sil
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name  = 'appointments'
      AND constraint_name LIKE '%payment_status%'
      AND constraint_type = 'CHECK'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE public.appointments DROP CONSTRAINT ' || constraint_name
      FROM information_schema.table_constraints
      WHERE table_name  = 'appointments'
        AND constraint_name LIKE '%payment_status%'
        AND constraint_type = 'CHECK'
      LIMIT 1
    );
  END IF;

  -- Genişletilmiş constraint ekle
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name    = 'appointments'
      AND constraint_name = 'appointments_payment_status_check_v2'
      AND constraint_type = 'CHECK'
  ) THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_payment_status_check_v2
      CHECK (payment_status IN (
        'none',
        'pending',
        'processing',
        'processing_refund',
        'held',
        'completed',
        'failed',
        'refunded_full',
        'refunded_partial'
      ));
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. İndeks — komisyon raporları için
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_payments_vet_id_status
  ON public.payments (vet_id, status);

CREATE INDEX IF NOT EXISTS idx_payments_appointment_id
  ON public.payments (appointment_id);
