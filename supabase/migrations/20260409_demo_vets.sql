-- Add is_demo column to veterinarians
ALTER TABLE public.veterinarians
ADD COLUMN IF NOT EXISTS is_demo boolean DEFAULT false;

-- Create waitlist table
CREATE TABLE IF NOT EXISTS public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  city text,
  source text default 'demo_card',
  created_at timestamptz default now()
);

-- RLS for waitlist
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "waitlist_insert_public"
  ON public.waitlist FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "waitlist_select_admin"
  ON public.waitlist FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
