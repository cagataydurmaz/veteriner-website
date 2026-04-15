-- =============================================================================
-- 3-Layer Vet State Machine — DB Schema
-- Layer 3: Reality flags — is_busy, buffer_lock, heartbeat_at
-- =============================================================================

ALTER TABLE public.veterinarians
  ADD COLUMN IF NOT EXISTS is_busy        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS buffer_lock    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS heartbeat_at   timestamptz;

-- Indexes for fast availability lookups
CREATE INDEX IF NOT EXISTS idx_vets_online_available
  ON public.veterinarians (is_online_now, is_busy, buffer_lock)
  WHERE is_online_now = true;

CREATE INDEX IF NOT EXISTS idx_vets_on_call
  ON public.veterinarians (is_on_call, is_busy)
  WHERE is_on_call = true;

CREATE INDEX IF NOT EXISTS idx_vets_heartbeat
  ON public.veterinarians (heartbeat_at)
  WHERE is_online_now = true;

-- =============================================================================
-- Function: compute_buffer_lock()
-- Sets buffer_lock=true if the vet has a clinic/online appointment within 30 min
-- Called by booking API and a periodic cron
-- =============================================================================
CREATE OR REPLACE FUNCTION public.compute_buffer_lock(p_vet_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
  v_now   timestamptz := now();
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.appointments
  WHERE vet_id = p_vet_id
    AND status IN ('pending', 'confirmed')
    AND datetime BETWEEN (v_now - INTERVAL '30 minutes') AND (v_now + INTERVAL '30 minutes');

  UPDATE public.veterinarians
  SET buffer_lock = (v_count > 0)
  WHERE id = p_vet_id;
END;
$$;

-- Grant execute to authenticated users (called from API routes via service client)
GRANT EXECUTE ON FUNCTION public.compute_buffer_lock(uuid) TO service_role;
