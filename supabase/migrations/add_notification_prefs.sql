-- Add notification preference columns to public.users
-- Run this in Supabase SQL Editor

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS whatsapp_notifications boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_notifications    boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminder_timing        text    DEFAULT '3h'
    CHECK (reminder_timing IN ('1h', '3h', '24h'));

-- Add rejection_reason to veterinarians for admin rejection flow
ALTER TABLE public.veterinarians
  ADD COLUMN IF NOT EXISTS rejection_reason text;
