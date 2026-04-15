-- ─────────────────────────────────────────────────────────────────────────────
-- OTP attempt limiting  (items 3 & 4)
-- Tracks failed OTP verifications per identifier (email or phone).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS otp_attempts (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier      text        NOT NULL,          -- normalised email or +90phone
  attempt_count   integer     NOT NULL DEFAULT 0,
  locked_until    timestamptz,                   -- NULL = not locked
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_otp_attempts_identifier
  ON otp_attempts (identifier);

-- Auto-purge rows older than 24 h (Postgres cron or a manual sweep is fine too)
COMMENT ON TABLE otp_attempts IS
  'Tracks failed OTP attempts; rows auto-expire after 24 h of inactivity.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Rate limiting for login attempts  (item 8)
-- Key format: "<ip>::<email>"
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rate_limit (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  key             text        NOT NULL,           -- "ip::email" composite
  attempt_count   integer     NOT NULL DEFAULT 0,
  locked_until    timestamptz,
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limit_key
  ON rate_limit (key);

COMMENT ON TABLE rate_limit IS
  '5 fails → 15 min; 10 fails → 1 h; 20 fails → 1 h + admin WhatsApp alert.';

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS: service role only (these tables are never queried from the client)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE otp_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit    ENABLE ROW LEVEL SECURITY;

-- No client-side access; all reads/writes go through service-role API routes.
CREATE POLICY "service_role_only_otp"
  ON otp_attempts FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_only_rate"
  ON rate_limit FOR ALL TO service_role USING (true) WITH CHECK (true);
