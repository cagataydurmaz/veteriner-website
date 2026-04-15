-- Legal compliance additions for Turkish law

-- Veterinarians: Chamber registration number and verification
ALTER TABLE veterinarians
  ADD COLUMN IF NOT EXISTS sicil_no TEXT,
  ADD COLUMN IF NOT EXISTS oda_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS oda_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS kanun_5996_accepted BOOLEAN DEFAULT FALSE;

-- Pets: Digital passport fields
ALTER TABLE pets
  ADD COLUMN IF NOT EXISTS microchip_number TEXT,
  ADD COLUMN IF NOT EXISTS passport_number TEXT,
  ADD COLUMN IF NOT EXISTS passport_issue_date DATE,
  ADD COLUMN IF NOT EXISTS passport_expiry DATE,
  ADD COLUMN IF NOT EXISTS rabies_vaccine_date DATE,
  ADD COLUMN IF NOT EXISTS rabies_vaccine_expiry DATE;

-- Log when disease reporting reminders are shown to vets
CREATE TABLE IF NOT EXISTS disease_report_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
  vet_id UUID REFERENCES veterinarians(id),
  disease_keywords TEXT[],
  shown_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(appointment_id)
);

-- Data breach notification log (admin use)
CREATE TABLE IF NOT EXISTS data_breach_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_by UUID REFERENCES users(id),
  description TEXT NOT NULL,
  affected_users_count INTEGER,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'notified')),
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- RLS for data_breach_notifications: admin only
ALTER TABLE data_breach_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin only breach notifications"
  ON data_breach_notifications
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- RLS for disease_report_reminders: vet who owns it
ALTER TABLE disease_report_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vet insert own disease reminders"
  ON disease_report_reminders FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM veterinarians WHERE id = vet_id AND user_id = auth.uid())
  );

CREATE POLICY "Admin read disease reminders"
  ON disease_report_reminders FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM veterinarians WHERE id = vet_id AND user_id = auth.uid())
  );
