-- ══════════════════════════════════════════════════════════════════════════════
-- VetBul — Definitive Admin RLS Fix
--
-- Problem: RLS_COMPLETE.sql drops admin policies for several tables but does not
-- recreate them. admin_setup.sql adds them back with IF NOT EXISTS, which is a
-- no-op if RLS_COMPLETE.sql ran last. This migration idempotently recreates all
-- missing admin policies using DROP IF EXISTS + CREATE (no IF NOT EXISTS guard).
--
-- Safe to run multiple times — all statements are fully idempotent.
-- ══════════════════════════════════════════════════════════════════════════════

-- Helper macro: admin check used in all policies
-- EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')

-- ════════════════════════════════════════════════════════════
-- USERS — admin reads + updates all rows
-- ════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Admin reads all users"   ON public.users;
DROP POLICY IF EXISTS "Admin updates all users" ON public.users;

-- Admin SELECT: replaces the combined "User reads own row" with a broader policy
-- for admins. We keep "User reads own row" for non-admins, so we just add admin.
CREATE POLICY "Admin reads all users"
  ON public.users
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Admin can UPDATE any user row (e.g. change account_status, suspend, ban)
CREATE POLICY "Admin updates all users"
  ON public.users
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- ════════════════════════════════════════════════════════════
-- APPOINTMENTS — admin reads all, can update status
-- ════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Admin reads all appointments"   ON public.appointments;
DROP POLICY IF EXISTS "Admin updates all appointments" ON public.appointments;

CREATE POLICY "Admin reads all appointments"
  ON public.appointments
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin updates all appointments"
  ON public.appointments
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- ════════════════════════════════════════════════════════════
-- PAYMENTS — admin reads all payments for financial overview
-- ════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Admin reads all payments" ON public.payments;

CREATE POLICY "Admin reads all payments"
  ON public.payments
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- ════════════════════════════════════════════════════════════
-- REVIEWS — admin reads + manages all reviews (moderation)
-- ════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Admin manages reviews" ON public.reviews;

CREATE POLICY "Admin manages reviews"
  ON public.reviews
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- ════════════════════════════════════════════════════════════
-- DISPUTES — admin reads + manages all disputes
-- ════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Admin manages disputes" ON public.disputes;

CREATE POLICY "Admin manages disputes"
  ON public.disputes
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- ════════════════════════════════════════════════════════════
-- SUBSCRIPTIONS — admin reads all subscriptions
-- ════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Admin reads subscriptions" ON public.subscriptions;

CREATE POLICY "Admin reads subscriptions"
  ON public.subscriptions
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- ════════════════════════════════════════════════════════════
-- MEDICAL RECORDS — admin reads all records (audit/support)
-- ════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Admin reads medical records" ON public.medical_records;

CREATE POLICY "Admin reads medical records"
  ON public.medical_records
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- ════════════════════════════════════════════════════════════
-- SYSTEM_ERRORS — restore admin read policy
-- (RLS_COMPLETE.sql intentionally dropped this; we restore it so
--  the admin panel can query system_errors via createClient())
-- ════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Admin reads system errors" ON public.system_errors;

CREATE POLICY "Admin reads system errors"
  ON public.system_errors
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- ════════════════════════════════════════════════════════════
-- NOTE: veterinarians admin policy is handled by 20260409_fix_vet_rls.sql
-- which creates "vets_admin_all" — no change needed here.
-- ════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════
-- VERIFY — list all admin policies
-- ════════════════════════════════════════════════════════════
SELECT
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    policyname ILIKE '%admin%'
    OR policyname ILIKE '%vets_admin%'
  )
ORDER BY tablename, cmd;
