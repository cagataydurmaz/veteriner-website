-- ============================================================
-- VetBul — Admin Panel Setup
-- Supabase SQL Editor'da çalıştır
-- ============================================================

-- ── 1. SYSTEM_ERRORS TABLE ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.system_errors (
  id          uuid primary key default gen_random_uuid(),
  severity    text not null default 'low'
    check (severity in ('low','medium','high','critical')),
  message     text not null,
  context     jsonb,
  resolved    boolean default false,
  created_at  timestamptz default now()
);

ALTER TABLE public.system_errors ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='system_errors' AND policyname='Admin reads system errors') THEN
    CREATE POLICY "Admin reads system errors" ON public.system_errors FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

-- ── 2. DATA_BREACH_NOTIFICATIONS TABLE ───────────────────────
CREATE TABLE IF NOT EXISTS public.data_breach_notifications (
  id                uuid primary key default gen_random_uuid(),
  detected_at       timestamptz not null default now(),
  affected_users    integer default 0,
  description       text not null,
  severity          text not null default 'low'
    check (severity in ('low','medium','high','critical')),
  status            text not null default 'open'
    check (status in ('open','investigating','resolved','notified')),
  notified_users    boolean default false,
  notified_btk      boolean default false,
  resolution_notes  text,
  created_at        timestamptz default now()
);

ALTER TABLE public.data_breach_notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='data_breach_notifications' AND policyname='Admin manages data breaches') THEN
    CREATE POLICY "Admin manages data breaches" ON public.data_breach_notifications FOR ALL USING (
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

-- ── 3. ADMIN RLS POLİCİES (mevcut tablolar için) ─────────────
-- Admin can read all users
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='users' AND policyname='Admin reads all users') THEN
    CREATE POLICY "Admin reads all users" ON public.users FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
      OR auth.uid() = id
    );
  END IF;
END $$;

-- Admin can read all veterinarians
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='veterinarians' AND policyname='Admin reads all vets') THEN
    CREATE POLICY "Admin reads all vets" ON public.veterinarians FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
      OR user_id = auth.uid()
      OR true  -- public list
    );
  END IF;
END $$;

-- Admin can update veterinarians (for approval)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='veterinarians' AND policyname='Admin updates vets') THEN
    CREATE POLICY "Admin updates vets" ON public.veterinarians FOR UPDATE USING (
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
      OR user_id = auth.uid()
    );
  END IF;
END $$;

-- Admin can read all appointments
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='appointments' AND policyname='Admin reads all appointments') THEN
    CREATE POLICY "Admin reads all appointments" ON public.appointments FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
      OR owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.veterinarians v WHERE v.id = vet_id AND v.user_id = auth.uid())
    );
  END IF;
END $$;

-- Admin can read all payments
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='payments' AND policyname='Admin reads all payments') THEN
    CREATE POLICY "Admin reads all payments" ON public.payments FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
      OR owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.veterinarians v WHERE v.id = vet_id AND v.user_id = auth.uid())
    );
  END IF;
END $$;

-- ── 4. TEST: Admin rolüne geç ────────────────────────────────
-- Aktif et: UPDATE public.users SET role = 'admin' WHERE email = 'durmazcagatay@gmail.com';
-- Test bitince geri al: UPDATE public.users SET role = 'vet' WHERE email = 'durmazcagatay@gmail.com';

-- ── 5. Test sistem hatası ekle ───────────────────────────────
INSERT INTO public.system_errors (severity, message, context)
VALUES
  ('high', 'Agora token oluşturma süresi aşıldı', '{"endpoint": "/api/video/agora-token", "latency_ms": 5200}'),
  ('medium', 'Ödeme webhook doğrulaması başarısız', '{"provider": "iyzico", "attempts": 3}')
ON CONFLICT DO NOTHING;

-- ── 6. Sonuçları kontrol et ──────────────────────────────────
SELECT
  (SELECT count(*) FROM public.system_errors)               as system_errors,
  (SELECT count(*) FROM public.data_breach_notifications)   as data_breach_notifications,
  (SELECT count(*) FROM public.users WHERE role = 'admin')  as admin_users;
