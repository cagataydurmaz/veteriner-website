-- WhatsApp outbound queue
-- All WhatsApp messages go through this table; a cron job sends them every minute.
-- This ensures API calls are never blocking and we get automatic retry logic.

CREATE TABLE IF NOT EXISTS whatsapp_queue (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  to_number     text        NOT NULL,
  message       text        NOT NULL,
  status        text        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'sent', 'failed')),
  retry_count   integer     NOT NULL DEFAULT 0,
  error         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  sent_at       timestamptz,
  next_retry_at timestamptz
);

-- Fast lookup for the cron worker
CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_status_retry
  ON whatsapp_queue (status, next_retry_at)
  WHERE status = 'pending';

-- Optional: auto-delete sent messages after 30 days to keep the table lean
-- (requires pg_cron or run manually)
-- DELETE FROM whatsapp_queue WHERE status = 'sent' AND sent_at < now() - interval '30 days';
