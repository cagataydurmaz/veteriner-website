-- Prevent double-booking at the database level.
-- This partial unique index ensures no two active (pending or confirmed)
-- appointments can share the same vet + datetime slot, even under concurrent
-- inserts. Any duplicate insert will fail with error code 23505.
CREATE UNIQUE INDEX IF NOT EXISTS appointments_vet_slot_unique
  ON appointments (vet_id, datetime)
  WHERE status IN ('pending', 'confirmed');

-- Index comment for documentation
COMMENT ON INDEX appointments_vet_slot_unique IS
  'Prevents double-booking: one active appointment per vet per time slot.
   Only enforced for pending/confirmed statuses; cancelled/completed slots
   can be reused.';
