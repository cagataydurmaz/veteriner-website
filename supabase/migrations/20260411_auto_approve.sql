ALTER TABLE public.veterinarians
  ADD COLUMN IF NOT EXISTS auto_approve_appointments boolean DEFAULT false;
