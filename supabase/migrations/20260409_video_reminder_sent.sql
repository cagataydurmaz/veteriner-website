-- Add reminder_sent flag to appointments for 10-minute video pre-call WhatsApp notifications
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS reminder_sent boolean NOT NULL DEFAULT false;

-- Partial index for fast cron queries (only scans unflagged upcoming video appointments)
CREATE INDEX IF NOT EXISTS idx_appointments_video_reminder
  ON public.appointments (datetime, reminder_sent)
  WHERE type = 'video' AND status = 'confirmed' AND reminder_sent = false;
