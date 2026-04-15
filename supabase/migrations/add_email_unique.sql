-- Add UNIQUE constraint to public.users.email
-- Run this in Supabase SQL Editor

-- First remove any accidental duplicates (keep the oldest one)
DELETE FROM public.users u1
USING public.users u2
WHERE u1.email = u2.email
  AND u1.created_at > u2.created_at
  AND u1.email IS NOT NULL;

-- Add the constraint
ALTER TABLE public.users
  ADD CONSTRAINT users_email_unique UNIQUE (email);
