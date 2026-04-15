-- Anlık müsaitlik toggle: veteriner kendini online/offline yapabilir
ALTER TABLE public.veterinarians
  ADD COLUMN IF NOT EXISTS is_online_now boolean NOT NULL DEFAULT false;

-- 48 saatlik post-randevu mesajlaşma penceresi
-- Randevu tamamlandığında set edilir: now() + 48h
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS messaging_expires_at timestamptz DEFAULT NULL;

-- Index: online veterinerleri hızlı çek
CREATE INDEX IF NOT EXISTS idx_vets_online_now
  ON public.veterinarians (is_online_now)
  WHERE is_online_now = true;

-- Index: mesajlaşma süresi dolmamış randevular
CREATE INDEX IF NOT EXISTS idx_appointments_messaging_active
  ON public.appointments (messaging_expires_at)
  WHERE messaging_expires_at IS NOT NULL;
