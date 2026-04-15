-- ============================================================
-- VetBul — Complete Schema Fix
-- Supabase SQL Editor'da çalıştır
-- ============================================================

-- ── 1. APPOINTMENTS ─────────────────────────────────────────
ALTER TABLE public.appointments
  RENAME COLUMN scheduled_at TO datetime;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS complaint      text,
  ADD COLUMN IF NOT EXISTS payment_status text default 'pending'
    check (payment_status in ('pending','paid','refunded','waived')),
  ADD COLUMN IF NOT EXISTS payment_amount integer;

-- ── 2. VETERINARIANS ────────────────────────────────────────
ALTER TABLE public.veterinarians
  DROP CONSTRAINT IF EXISTS veterinarians_subscription_tier_check;

ALTER TABLE public.veterinarians
  ADD CONSTRAINT veterinarians_subscription_tier_check
  CHECK (subscription_tier IN ('free','basic','pro','premium'));

UPDATE public.veterinarians
  SET subscription_tier = 'basic' WHERE subscription_tier = 'free';

ALTER TABLE public.veterinarians
  ALTER COLUMN subscription_tier SET DEFAULT 'basic';

ALTER TABLE public.veterinarians
  ADD COLUMN IF NOT EXISTS offers_in_person       boolean default true,
  ADD COLUMN IF NOT EXISTS offers_video           boolean default false,
  ADD COLUMN IF NOT EXISTS offers_nobetci         boolean default false,
  ADD COLUMN IF NOT EXISTS is_on_call             boolean default false,
  ADD COLUMN IF NOT EXISTS video_consultation_fee integer default 300,
  ADD COLUMN IF NOT EXISTS district               text,
  ADD COLUMN IF NOT EXISTS sicil_no               text,
  ADD COLUMN IF NOT EXISTS license_document_url   text,
  ADD COLUMN IF NOT EXISTS terms_accepted         boolean default false,
  ADD COLUMN IF NOT EXISTS terms_accepted_at      timestamptz,
  ADD COLUMN IF NOT EXISTS suspension_until       timestamptz,
  ADD COLUMN IF NOT EXISTS violation_count        integer default 0,
  ADD COLUMN IF NOT EXISTS is_banned              boolean default false,
  ADD COLUMN IF NOT EXISTS kanun_5996_accepted    boolean default false;

-- ── 3. PETS ─────────────────────────────────────────────────
ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS allergies          text,
  ADD COLUMN IF NOT EXISTS chronic_conditions text,
  ADD COLUMN IF NOT EXISTS blood_type         text,
  ADD COLUMN IF NOT EXISTS passport_number    text;

-- ── 4. PAYMENTS TABLE ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payments (
  id             uuid primary key default gen_random_uuid(),
  vet_id         uuid references public.veterinarians(id) on delete cascade,
  owner_id       uuid references public.users(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  amount         integer not null,
  status         text not null default 'pending'
    check (status in ('pending','success','failed','refunded_full','refunded_partial')),
  type           text not null default 'video_consultation'
    check (type in ('subscription','video_consultation','in_person')),
  iyzico_payment_id text,
  created_at     timestamptz default now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='payments' AND policyname='Vet reads own payments') THEN
    CREATE POLICY "Vet reads own payments" ON public.payments FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.veterinarians v WHERE v.id = vet_id AND v.user_id = auth.uid())
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='payments' AND policyname='Owner reads own payments') THEN
    CREATE POLICY "Owner reads own payments" ON public.payments FOR SELECT USING (auth.uid() = owner_id);
  END IF;
END $$;

-- ── 5. OWNER RATINGS TABLE ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.owner_ratings (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments(id) on delete cascade unique,
  vet_id         uuid references public.veterinarians(id) on delete cascade,
  owner_id       uuid references public.users(id) on delete cascade,
  rating         integer not null check (rating between 1 and 5),
  note           text,
  created_at     timestamptz default now()
);

ALTER TABLE public.owner_ratings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='owner_ratings' AND policyname='Vet insert own owner ratings') THEN
    CREATE POLICY "Vet insert own owner ratings" ON public.owner_ratings FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.veterinarians v WHERE v.id = vet_id AND v.user_id = auth.uid())
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='owner_ratings' AND policyname='Vet read own owner ratings') THEN
    CREATE POLICY "Vet read own owner ratings" ON public.owner_ratings FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.veterinarians v WHERE v.id = vet_id AND v.user_id = auth.uid())
    );
  END IF;
END $$;

-- ── 6. MESSAGES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  sender_id      uuid not null references public.users(id),
  receiver_id    uuid not null references public.users(id),
  content        text not null,
  is_read        boolean default false,
  created_at     timestamptz default now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='messages' AND policyname='Users view own messages') THEN
    CREATE POLICY "Users view own messages" ON public.messages FOR SELECT
      USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='messages' AND policyname='Users send messages') THEN
    CREATE POLICY "Users send messages" ON public.messages FOR INSERT
      WITH CHECK (auth.uid() = sender_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='messages' AND policyname='Users mark read') THEN
    CREATE POLICY "Users mark read" ON public.messages FOR UPDATE
      USING (auth.uid() = receiver_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.blocked_messages (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments(id) on delete set null,
  sender_id      uuid not null references public.users(id),
  content        text not null,
  block_reason   text not null,
  created_at     timestamptz default now()
);

ALTER TABLE public.blocked_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='blocked_messages' AND policyname='Log blocked messages') THEN
    CREATE POLICY "Log blocked messages" ON public.blocked_messages FOR INSERT
      WITH CHECK (auth.uid() = sender_id);
  END IF;
END $$;

-- ── 7. VACCINES TABLE ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vaccines (
  id            uuid primary key default gen_random_uuid(),
  pet_id        uuid references public.pets(id) on delete cascade,
  name          text not null,
  date_given    date,
  next_due_date date,
  vet_name      text,
  notes         text,
  created_at    timestamptz default now()
);

ALTER TABLE public.vaccines ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='vaccines' AND policyname='Owner manages vaccines') THEN
    CREATE POLICY "Owner manages vaccines" ON public.vaccines FOR ALL USING (
      EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.owner_id = auth.uid())
    );
  END IF;
END $$;

-- ── 8. TEST HESABI ───────────────────────────────────────────
INSERT INTO public.veterinarians (
  user_id, specialty, city, subscription_tier,
  is_verified, offers_in_person, consultation_fee, video_consultation_fee
)
SELECT
  id, 'Genel Pratisyen', 'İstanbul', 'basic',
  false, true, 300, 240
FROM public.users
WHERE email = 'durmazcagatay@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

-- ── 9. INDEXES ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_appointments_datetime ON public.appointments(datetime);
CREATE INDEX IF NOT EXISTS idx_appointments_vet      ON public.appointments(vet_id);
CREATE INDEX IF NOT EXISTS idx_appointments_owner    ON public.appointments(owner_id);
CREATE INDEX IF NOT EXISTS idx_vets_city             ON public.veterinarians(city);
CREATE INDEX IF NOT EXISTS idx_vets_on_call          ON public.veterinarians(is_on_call) WHERE is_on_call = true;
CREATE INDEX IF NOT EXISTS idx_vets_video            ON public.veterinarians(offers_video) WHERE offers_video = true;
CREATE INDEX IF NOT EXISTS idx_vets_nobetci          ON public.veterinarians(offers_nobetci) WHERE offers_nobetci = true;
