-- ══════════════════════════════════════════════════════════════════════════════
-- Migration: Vet online status, rate limiting, video connections
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Vet online/last-active tracking
ALTER TABLE public.veterinarians
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_count INTEGER NOT NULL DEFAULT 0;

-- 2. Simple rate-limit ledger (rolling window counts per user+action)
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL,
  action     TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup
  ON public.rate_limits (user_id, action, created_at);

-- Auto-purge records older than 48h to keep the table lean
CREATE OR REPLACE FUNCTION public.purge_old_rate_limits() RETURNS void LANGUAGE sql AS $$
  DELETE FROM public.rate_limits WHERE created_at < now() - interval '48 hours';
$$;

-- 3. Video connection tracking
CREATE TABLE IF NOT EXISTS public.video_connections (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id      UUID        NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  user_id             UUID        NOT NULL REFERENCES public.users(id)        ON DELETE CASCADE,
  role                TEXT        NOT NULL CHECK (role IN ('vet', 'owner')),
  connected_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  disconnected_at     TIMESTAMPTZ,
  notified_no_connect BOOLEAN     NOT NULL DEFAULT false,
  UNIQUE (appointment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_video_conn_apt
  ON public.video_connections (appointment_id);

CREATE INDEX IF NOT EXISTS idx_video_conn_user
  ON public.video_connections (user_id, appointment_id);

-- 4. Cancellation reason on appointments
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
