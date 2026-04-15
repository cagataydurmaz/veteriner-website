-- ============================================================
-- Veterinarians table: RLS policy fixes
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Allow vets to INSERT their own row
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'veterinarians'
      AND policyname = 'vet_insert_own_profile'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY vet_insert_own_profile ON public.veterinarians
      FOR INSERT WITH CHECK (auth.uid() = user_id);
    $policy$;
  END IF;
END $$;

-- 2. Allow vets to UPDATE their own row
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'veterinarians'
      AND policyname = 'vet_update_own_profile'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY vet_update_own_profile ON public.veterinarians
      FOR UPDATE
      USING     (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
    $policy$;
  END IF;
END $$;

-- 3. Allow vets to SELECT their own row (profile page fetch)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'veterinarians'
      AND policyname = 'vet_select_own_profile'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY vet_select_own_profile ON public.veterinarians
      FOR SELECT USING (auth.uid() = user_id OR is_verified = true);
    $policy$;
  END IF;
END $$;

-- 4. Fix test accounts: reset role to vet for accounts
--    that went through vet-register but ended up as owner.
--    !! Change the email below to your test email !!
-- UPDATE public.users SET role = 'vet' WHERE email = 'your-test@gmail.com';
-- UPDATE public.users SET role = 'owner' WHERE email = 'your-owner-test@gmail.com';
