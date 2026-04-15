-- ═══════════════════════════════════════════════════════════════════════════
-- Veteriner Bul — In-App Support System
-- Migration: 20260412_support_system.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Tables ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.support_threads (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subject                     text,
  status                      text        NOT NULL DEFAULT 'ai_handling'
                                CHECK (status IN ('ai_handling', 'human_required', 'resolved')),
  -- Seen tracking for 2-minute mail fallback
  last_message_at             timestamptz NOT NULL DEFAULT now(),
  last_seen_by_user_at        timestamptz DEFAULT now(),
  last_seen_by_admin_at       timestamptz,
  -- Pending email notification tracking
  admin_notification_pending  boolean     NOT NULL DEFAULT false,
  admin_message_sent_at       timestamptz,
  admin_notification_sent_at  timestamptz,
  -- Satisfaction survey
  resolution_feedback_sent    boolean     NOT NULL DEFAULT false,
  resolved_at                 timestamptz,
  created_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.support_messages (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   uuid        NOT NULL REFERENCES public.support_threads(id) ON DELETE CASCADE,
  sender_type text        NOT NULL CHECK (sender_type IN ('user', 'ai', 'admin')),
  sender_id   uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  content     text        NOT NULL,
  metadata    jsonb       DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_support_threads_user_id  ON public.support_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_support_threads_status   ON public.support_threads(status);
CREATE INDEX IF NOT EXISTS idx_support_messages_thread  ON public.support_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_support_notify_pending
  ON public.support_threads(admin_notification_pending, admin_message_sent_at)
  WHERE admin_notification_pending = true;

-- ── 2. Row Level Security ────────────────────────────────────────────────────

ALTER TABLE public.support_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Users can read their own threads
CREATE POLICY "users_own_threads_select"
  ON public.support_threads FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own threads
CREATE POLICY "users_own_threads_insert"
  ON public.support_threads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own threads (for last_seen_by_user_at)
CREATE POLICY "users_own_threads_update"
  ON public.support_threads FOR UPDATE
  USING (auth.uid() = user_id);

-- Admins can do anything on threads
CREATE POLICY "admins_all_threads"
  ON public.support_threads FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Users can read messages in their own threads
CREATE POLICY "users_own_thread_messages_select"
  ON public.support_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.support_threads t
      WHERE t.id = thread_id AND t.user_id = auth.uid()
    )
  );

-- Users can insert messages in their own threads
CREATE POLICY "users_own_thread_messages_insert"
  ON public.support_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.support_threads t
      WHERE t.id = thread_id AND t.user_id = auth.uid()
    )
  );

-- Admins can do anything on messages
CREATE POLICY "admins_all_messages"
  ON public.support_messages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ── 3. DB trigger: set admin_notification_pending on admin message ────────────

CREATE OR REPLACE FUNCTION public.fn_support_admin_message_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.sender_type = 'admin' THEN
    UPDATE public.support_threads
    SET
      last_message_at            = now(),
      admin_notification_pending = true,
      admin_message_sent_at      = now(),
      admin_notification_sent_at = NULL
    WHERE id = NEW.thread_id;
  ELSE
    -- Any non-admin message: just update last_message_at
    UPDATE public.support_threads
    SET last_message_at = now()
    WHERE id = NEW.thread_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_admin_message_notify ON public.support_messages;
CREATE TRIGGER trg_support_admin_message_notify
  AFTER INSERT ON public.support_messages
  FOR EACH ROW EXECUTE FUNCTION public.fn_support_admin_message_notify();

-- ── 4. Optional: pg_cron + pg_net scheduled notification dispatch ─────────────
-- Enable these if your Supabase plan supports pg_cron + pg_net.
-- Run in the Supabase SQL Editor if needed:
--
--   CREATE EXTENSION IF NOT EXISTS pg_cron;
--   CREATE EXTENSION IF NOT EXISTS pg_net;
--
--   SELECT cron.schedule(
--     'support-notify-unseen',
--     '*/2 * * * *',                            -- every 2 minutes
--     $$
--       SELECT net.http_post(
--         url     := current_setting('app.base_url') || '/api/cron/support-notify',
--         headers := '{"Content-Type":"application/json","x-cron-secret":"' ||
--                    current_setting('app.cron_secret') || '"}'::jsonb,
--         body    := '{}'::jsonb
--       );
--     $$
--   );
--
-- Set in Supabase Dashboard → Settings → Vault / Config:
--   app.base_url  = https://veterinerbul.com.tr
--   app.cron_secret = <your CRON_SECRET env var>

-- ── Done ─────────────────────────────────────────────────────────────────────
