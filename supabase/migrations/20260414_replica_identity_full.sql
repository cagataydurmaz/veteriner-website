-- Enable REPLICA IDENTITY FULL on the appointments table.
--
-- Why this matters:
--   Supabase postgres_changes for DELETE events only includes payload.old when
--   the table has REPLICA IDENTITY FULL. The default (REPLICA IDENTITY DEFAULT)
--   only includes primary-key columns in payload.old, so payload.old.datetime
--   is undefined → NewAppointmentListener cannot format the delete toast and
--   falls back to a bare router.refresh() without any user-visible notification.
--
-- This setting is safe for tables with high UPDATE/DELETE frequency; the only
-- trade-off is slightly larger WAL records (full row instead of just changed
-- columns). For an appointments table this is acceptable.

ALTER TABLE appointments REPLICA IDENTITY FULL;

-- Add appointments table to the Supabase Realtime publication.
--
-- Without this, postgres_changes events (INSERT, UPDATE, DELETE) are
-- never emitted to client-side subscribers — NewAppointmentListener
-- will never fire regardless of the channel filter or RLS policy.
--
-- In hosted Supabase projects this is normally done via the dashboard
-- (Table Editor → Realtime toggle), but an explicit migration ensures
-- the setting survives schema resets and is documented in version control.
--
-- If the table is already in the publication this is a no-op:
--   ALTER PUBLICATION supabase_realtime ADD TABLE <already-included-table>
--   simply returns without error on Postgres 13+.
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
