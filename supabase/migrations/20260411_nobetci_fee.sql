-- Add nobetci_fee column to veterinarians table
-- This column was referenced in the vet profile page but never added to the DB.
ALTER TABLE public.veterinarians
  ADD COLUMN IF NOT EXISTS nobetci_fee integer DEFAULT 500;
