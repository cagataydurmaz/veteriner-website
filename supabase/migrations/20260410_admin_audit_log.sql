-- Admin action audit log.
-- Every ban, suspend, delete, approve, reject action performed via the admin
-- panel is recorded here for accountability and KVKK compliance.
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  action        text NOT NULL,          -- e.g. 'approve_vet', 'ban_owner', 'delete_account'
  target_type   text NOT NULL,          -- 'vet' | 'owner'
  target_id     uuid NOT NULL,          -- the affected user/vet id
  reason        text,                   -- human-readable note / reason
  metadata      jsonb,                  -- extra context (e.g. duration, suspended_until)
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Admins can read all logs; only service role can insert/update/delete
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_read_audit_logs"
  ON admin_audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Index for quick per-target lookups
CREATE INDEX IF NOT EXISTS admin_audit_logs_target_idx ON admin_audit_logs (target_type, target_id);
CREATE INDEX IF NOT EXISTS admin_audit_logs_created_at_idx ON admin_audit_logs (created_at DESC);
