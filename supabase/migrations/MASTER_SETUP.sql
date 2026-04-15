-- ╔══════════════════════════════════════════════════════════════╗
-- ║         VetBul — MASTER SETUP (TEK SEFERLIK)                ║
-- ║  complete_fix.sql + admin_setup.sql zaten çalıştı.          ║
-- ║  Bu dosya geri kalan HER ŞEYİ tamamlar.                     ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ════════════════════════════════════════════════════════════════
-- BÖLÜM 1: EKSİK TABLOLAR
-- ════════════════════════════════════════════════════════════════

-- ── notifications ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  title      text not null,
  created_at timestamptz default now()
);
DO $$
BEGIN
  ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS body    text default '';
  ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type    text default 'info';
  ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_read boolean default false;
  ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link    text;

  CREATE INDEX IF NOT EXISTS idx_notifications_user   ON public.notifications(user_id);
  CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id,is_read) WHERE is_read=false;
  ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notifications' AND policyname='User manages own notifications') THEN
    CREATE POLICY "User manages own notifications" ON public.notifications FOR ALL USING (auth.uid()=user_id);
  END IF;
END $$;

-- ── availability_slots ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.availability_slots (
  id          uuid primary key default gen_random_uuid(),
  vet_id      uuid not null references public.veterinarians(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  start_time  time not null,
  end_time    time not null,
  is_active   boolean default true,
  created_at  timestamptz default now()
);
CREATE INDEX IF NOT EXISTS idx_availability_vet ON public.availability_slots(vet_id);
ALTER TABLE public.availability_slots ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='availability_slots' AND policyname='Public reads availability') THEN
    CREATE POLICY "Public reads availability" ON public.availability_slots FOR SELECT USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='availability_slots' AND policyname='Vet manages own availability') THEN
    CREATE POLICY "Vet manages own availability" ON public.availability_slots FOR ALL USING (
      EXISTS (SELECT 1 FROM public.veterinarians v WHERE v.id=vet_id AND v.user_id=auth.uid())
    );
  END IF;
END $$;

-- ── medical_records ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.medical_records (
  id             uuid primary key default gen_random_uuid(),
  pet_id         uuid references public.pets(id) on delete set null,
  vet_id         uuid references public.veterinarians(id) on delete set null,
  created_at     timestamptz default now()
);
DO $$
BEGIN
  ALTER TABLE public.medical_records ADD COLUMN IF NOT EXISTS appointment_id uuid;
  ALTER TABLE public.medical_records ADD COLUMN IF NOT EXISTS voice_note_url text;
  ALTER TABLE public.medical_records ADD COLUMN IF NOT EXISTS transcription  text;
  ALTER TABLE public.medical_records ADD COLUMN IF NOT EXISTS soap_notes     jsonb;
  ALTER TABLE public.medical_records ADD COLUMN IF NOT EXISTS medications    jsonb;
  ALTER TABLE public.medical_records ADD COLUMN IF NOT EXISTS follow_up_date date;
  ALTER TABLE public.medical_records ADD COLUMN IF NOT EXISTS vet_notes      text;
  ALTER TABLE public.medical_records ADD COLUMN IF NOT EXISTS is_private     boolean default false;
  ALTER TABLE public.medical_records ADD COLUMN IF NOT EXISTS updated_at     timestamptz default now();

  CREATE INDEX IF NOT EXISTS idx_medical_pet ON public.medical_records(pet_id);
  CREATE INDEX IF NOT EXISTS idx_medical_vet ON public.medical_records(vet_id);

  ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='medical_records' AND policyname='Vet manages own records') THEN
    CREATE POLICY "Vet manages own records" ON public.medical_records FOR ALL USING (
      EXISTS (SELECT 1 FROM public.veterinarians v WHERE v.id=vet_id AND v.user_id=auth.uid())
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='medical_records' AND policyname='Owner reads own pet records') THEN
    CREATE POLICY "Owner reads own pet records" ON public.medical_records FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.pets p WHERE p.id=pet_id AND p.owner_id=auth.uid()) AND is_private=false
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='medical_records' AND policyname='Admin reads medical records') THEN
    CREATE POLICY "Admin reads medical records" ON public.medical_records FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.users WHERE id=auth.uid() AND role='admin')
    );
  END IF;
END $$;

-- ── reviews ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reviews (
  id          uuid primary key default gen_random_uuid(),
  vet_id      uuid not null references public.veterinarians(id) on delete cascade,
  owner_id    uuid not null references public.users(id) on delete cascade,
  rating      integer not null check (rating between 1 and 5),
  created_at  timestamptz default now()
);
-- Tüm kolonları aynı blokta ekle + policy oluştur (transaction garantisi)
DO $$
BEGIN
  ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS appointment_id uuid;
  ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS comment        text;
  ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS is_approved    boolean default false;
  ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS is_flagged     boolean default false;

  CREATE INDEX IF NOT EXISTS idx_reviews_vet ON public.reviews(vet_id);

  ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reviews' AND policyname='Owner submits review') THEN
    CREATE POLICY "Owner submits review" ON public.reviews FOR INSERT WITH CHECK (auth.uid()=owner_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reviews' AND policyname='Public reads approved') THEN
    CREATE POLICY "Public reads approved" ON public.reviews FOR SELECT USING (is_approved=true OR auth.uid()=owner_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reviews' AND policyname='Admin manages reviews') THEN
    CREATE POLICY "Admin manages reviews" ON public.reviews FOR ALL USING (
      EXISTS (SELECT 1 FROM public.users WHERE id=auth.uid() AND role='admin')
    );
  END IF;
END $$;

-- ── subscriptions ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id         uuid primary key default gen_random_uuid(),
  vet_id     uuid not null references public.veterinarians(id) on delete cascade,
  created_at timestamptz default now()
);
DO $$
BEGIN
  -- Gerçek kolon isimleri: starts_at, ends_at, iyzico_token
  ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS starts_at     timestamptz default now();
  ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS ends_at       timestamptz;
  ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS iyzico_token  text;

  -- tier constraint'e 'basic' ekle
  ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_tier_check;
  ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_tier_check
    CHECK (tier IN ('basic', 'pro', 'premium'));

  CREATE INDEX IF NOT EXISTS idx_subscriptions_vet ON public.subscriptions(vet_id);
  ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='subscriptions' AND policyname='Vet reads own subscriptions') THEN
    CREATE POLICY "Vet reads own subscriptions" ON public.subscriptions FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.veterinarians v WHERE v.id=vet_id AND v.user_id=auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='subscriptions' AND policyname='Admin reads subscriptions') THEN
    CREATE POLICY "Admin reads subscriptions" ON public.subscriptions FOR ALL USING (
      EXISTS (SELECT 1 FROM public.users WHERE id=auth.uid() AND role='admin')
    );
  END IF;
END $$;

-- ── reminders ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reminders (
  id              uuid primary key default gen_random_uuid(),
  pet_id          uuid not null references public.pets(id) on delete cascade,
  owner_id        uuid not null references public.users(id) on delete cascade,
  type            text not null check (type in ('vaccine','checkup','medication','appointment')),
  title           text not null,
  scheduled_at    timestamptz not null,
  sent_at         timestamptz,
  message_content text,
  delivery_status text default 'pending' check (delivery_status in ('pending','sent','failed')),
  created_at      timestamptz default now()
);
CREATE INDEX IF NOT EXISTS idx_reminders_owner   ON public.reminders(owner_id);
CREATE INDEX IF NOT EXISTS idx_reminders_pending ON public.reminders(delivery_status,scheduled_at) WHERE delivery_status='pending';
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reminders' AND policyname='Owner manages reminders') THEN
    CREATE POLICY "Owner manages reminders" ON public.reminders FOR ALL USING (auth.uid()=owner_id);
  END IF;
END $$;

-- ── symptom_checks ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.symptom_checks (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.users(id) on delete cascade,
  pet_id        uuid references public.pets(id) on delete set null,
  symptoms_text text not null,
  photo_url     text,
  ai_response   jsonb,
  urgency_level text check (urgency_level in ('low','medium','high','emergency')),
  created_at    timestamptz default now()
);
CREATE INDEX IF NOT EXISTS idx_symptom_owner ON public.symptom_checks(owner_id);
ALTER TABLE public.symptom_checks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='symptom_checks' AND policyname='Owner manages checks') THEN
    CREATE POLICY "Owner manages checks" ON public.symptom_checks FOR ALL USING (auth.uid()=owner_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='symptom_checks' AND policyname='Admin reads symptom checks') THEN
    CREATE POLICY "Admin reads symptom checks" ON public.symptom_checks FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.users WHERE id=auth.uid() AND role='admin')
    );
  END IF;
END $$;

-- ── weight_logs ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.weight_logs (
  id          uuid primary key default gen_random_uuid(),
  pet_id      uuid not null references public.pets(id) on delete cascade,
  weight      numeric(5,2) not null,
  recorded_at timestamptz default now(),
  notes       text
);
CREATE INDEX IF NOT EXISTS idx_weight_pet ON public.weight_logs(pet_id,recorded_at);
ALTER TABLE public.weight_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='weight_logs' AND policyname='Owner manages weight') THEN
    CREATE POLICY "Owner manages weight" ON public.weight_logs FOR ALL USING (
      EXISTS (SELECT 1 FROM public.pets p WHERE p.id=pet_id AND p.owner_id=auth.uid())
    );
  END IF;
END $$;

-- ── pet_photos ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pet_photos (
  id         uuid primary key default gen_random_uuid(),
  pet_id     uuid not null references public.pets(id) on delete cascade,
  photo_url  text not null,
  visit_date date,
  caption    text,
  created_at timestamptz default now()
);
CREATE INDEX IF NOT EXISTS idx_pet_photos ON public.pet_photos(pet_id);
ALTER TABLE public.pet_photos ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pet_photos' AND policyname='Owner manages photos') THEN
    CREATE POLICY "Owner manages photos" ON public.pet_photos FOR ALL USING (
      EXISTS (SELECT 1 FROM public.pets p WHERE p.id=pet_id AND p.owner_id=auth.uid())
    );
  END IF;
END $$;

-- ── disputes ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.disputes (
  id             uuid primary key default gen_random_uuid(),
  review_id      uuid references public.reviews(id) on delete cascade,
  vet_id         uuid not null references public.veterinarians(id) on delete cascade,
  reason         text not null,
  status         text not null default 'pending' check (status in ('pending','reviewing','resolved','dismissed')),
  admin_decision text,
  created_at     timestamptz default now(),
  resolved_at    timestamptz
);
CREATE INDEX IF NOT EXISTS idx_disputes_vet    ON public.disputes(vet_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON public.disputes(status);
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='disputes' AND policyname='Vet manages own disputes') THEN
    CREATE POLICY "Vet manages own disputes" ON public.disputes FOR ALL USING (
      EXISTS (SELECT 1 FROM public.veterinarians v WHERE v.id=vet_id AND v.user_id=auth.uid())
    );
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='disputes' AND policyname='Admin manages disputes') THEN
    CREATE POLICY "Admin manages disputes" ON public.disputes FOR ALL USING (
      EXISTS (SELECT 1 FROM public.users WHERE id=auth.uid() AND role='admin')
    );
  END IF;
END $$;

-- ── announcements ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.announcements (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  created_at timestamptz default now()
);
DO $$
BEGIN
  ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS body        text default '';
  ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS target_role text default 'all';
  ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS sent_at     timestamptz;
  ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS created_by  uuid;

  ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='announcements' AND policyname='Public reads sent announcements') THEN
    CREATE POLICY "Public reads sent announcements" ON public.announcements FOR SELECT USING (sent_at IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='announcements' AND policyname='Admin manages announcements') THEN
    CREATE POLICY "Admin manages announcements" ON public.announcements FOR ALL USING (
      EXISTS (SELECT 1 FROM public.users WHERE id=auth.uid() AND role='admin')
    );
  END IF;
END $$;

-- ── api_usage_logs ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.api_usage_logs (
  id            uuid primary key default gen_random_uuid(),
  api_type      text not null check (api_type in ('claude','whisper','whatsapp','agora')),
  user_id       uuid references public.users(id) on delete set null,
  tokens_used   integer,
  cost_estimate numeric(10,4),
  endpoint      text,
  created_at    timestamptz default now()
);
CREATE INDEX IF NOT EXISTS idx_api_type ON public.api_usage_logs(api_type,created_at);
ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='api_usage_logs' AND policyname='Admin reads api logs') THEN
    CREATE POLICY "Admin reads api logs" ON public.api_usage_logs FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.users WHERE id=auth.uid() AND role='admin')
    );
  END IF;
END $$;

-- ── blog_posts ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  created_at timestamptz default now()
);
DO $$
BEGIN
  ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS slug         text;
  ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS excerpt      text;
  ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS content      text;
  ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS cover_image  text;
  ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS author_id    uuid;
  ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS tags         text[] default '{}';
  ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS is_published boolean default false;
  ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS published_at timestamptz;
  ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS updated_at   timestamptz default now();

  CREATE INDEX IF NOT EXISTS idx_blog_slug      ON public.blog_posts(slug) WHERE slug IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_blog_published ON public.blog_posts(is_published, published_at);

  ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='blog_posts' AND policyname='Public reads published') THEN
    CREATE POLICY "Public reads published" ON public.blog_posts FOR SELECT USING (is_published=true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='blog_posts' AND policyname='Admin manages blog') THEN
    CREATE POLICY "Admin manages blog" ON public.blog_posts FOR ALL USING (
      EXISTS (SELECT 1 FROM public.users WHERE id=auth.uid() AND role='admin')
    );
  END IF;
END $$;

-- ── violation_reports ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.violation_reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.users(id),
  vet_id      uuid not null references public.veterinarians(id) on delete cascade,
  created_at  timestamptz default now()
);
DO $$
BEGIN
  ALTER TABLE public.violation_reports ADD COLUMN IF NOT EXISTS appointment_id uuid;
  ALTER TABLE public.violation_reports ADD COLUMN IF NOT EXISTS reason         text default 'diger';
  ALTER TABLE public.violation_reports ADD COLUMN IF NOT EXISTS details        text;
  ALTER TABLE public.violation_reports ADD COLUMN IF NOT EXISTS status         text default 'pending';
  ALTER TABLE public.violation_reports ADD COLUMN IF NOT EXISTS admin_note     text;
  ALTER TABLE public.violation_reports ADD COLUMN IF NOT EXISTS reviewed_at    timestamptz;

  CREATE INDEX IF NOT EXISTS idx_violation_vet    ON public.violation_reports(vet_id);
  CREATE INDEX IF NOT EXISTS idx_violation_status ON public.violation_reports(status);
  ALTER TABLE public.violation_reports ENABLE ROW LEVEL SECURITY;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='violation_reports' AND policyname='Owner submits violation') THEN
    CREATE POLICY "Owner submits violation" ON public.violation_reports FOR INSERT WITH CHECK (auth.uid()=reporter_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='violation_reports' AND policyname='Admin manages violations') THEN
    CREATE POLICY "Admin manages violations" ON public.violation_reports FOR ALL USING (
      EXISTS (SELECT 1 FROM public.users WHERE id=auth.uid() AND role='admin')
    );
  END IF;
END $$;

-- ── fraud_flags ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fraud_flags (
  id             uuid primary key default gen_random_uuid(),
  vet_id         uuid not null references public.veterinarians(id) on delete cascade,
  flag_type      text not null check (flag_type in (
    'repeated_cancellations_pair','high_cancellation_rate','no_completions_30days'
  )),
  details        jsonb default '{}',
  is_resolved    boolean default false,
  admin_notified boolean default false,
  created_at     timestamptz default now(),
  resolved_at    timestamptz
);
CREATE INDEX IF NOT EXISTS idx_fraud_vet      ON public.fraud_flags(vet_id);
CREATE INDEX IF NOT EXISTS idx_fraud_resolved ON public.fraud_flags(is_resolved);
ALTER TABLE public.fraud_flags ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fraud_flags' AND policyname='Admin manages fraud') THEN
    CREATE POLICY "Admin manages fraud" ON public.fraud_flags FOR ALL USING (
      EXISTS (SELECT 1 FROM public.users WHERE id=auth.uid() AND role='admin')
    );
  END IF;
END $$;


-- Pets: kod photo_url kullanıyor, DB'de avatar_url var — ikisini de ekle
ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS photo_url text;

-- ════════════════════════════════════════════════════════════════
-- BÖLÜM 2: TEST SEED DATA (Statik — kullanıcı bağımsız)
-- ════════════════════════════════════════════════════════════════

-- ── Blog yazıları ────────────────────────────────────────────────
INSERT INTO public.blog_posts (slug, title, excerpt, content, tags, is_published, published_at)
VALUES
  ('kopekte-asinin-onemi',
   'Köpeklerde Aşının Önemi',
   'Köpeğinizi hastalıklardan korumak için aşı takvimi hakkında bilmeniz gerekenler.',
   'Köpekler için aşı programı, hayatın ilk aylarından itibaren uygulanmalıdır. Kuduz, karma aşı ve Lyme aşısı temel koruma sağlar. Yılda bir tekrarlanan hatırlatma aşıları hastalıklara karşı bağışıklığı güçlendirir.',
   ARRAY['köpek','aşı','sağlık'], true, now() - interval '5 days'),
  ('kedi-beslenmesi-rehberi',
   'Kedi Beslenmesi: Yaşa Göre Doğru Diyet',
   'Yavru kedi, yetişkin ve yaşlı kedi için ideal beslenme programları.',
   'Kedilerin beslenme ihtiyaçları yaşa göre büyük farklılık gösterir. Yavru kediler yüksek protein içerikli mama ile beslenirken, yaşlı kediler için böbrek dostu düşük fosforlu diyetler önerilir.',
   ARRAY['kedi','beslenme','diyet'], true, now() - interval '2 days'),
  ('video-veteriner-rehberi',
   'Online Veteriner Görüşmesi Nasıl Yapılır?',
   'VetBul üzerinden video görüşme ile veterinere erişimin adım adım rehberi.',
   'Evcil hayvanınız için acil durum olmayan sağlık sorularınızı artık evinizden çözebilirsiniz. VetBul video görüşme özelliği ile lisanslı veterinerlerinizle 7/24 bağlantı kurabilirsiniz.',
   ARRAY['video','online','veteriner'], true, now() - interval '1 day')
ON CONFLICT (slug) DO NOTHING;

-- ── Duyurular ───────────────────────────────────────────────────
INSERT INTO public.announcements (title, body, target_role, sent_at)
VALUES
  ('VetBul Hizmetinizde!',
   'Türkiye''nin ilk online veteriner platformuna hoş geldiniz. Evcil hayvanlarınızın sağlığı için 7/24 hizmetinizdeyiz.',
   'all', now() - interval '10 days'),
  ('Video Görüşme Özelliği Aktif',
   'Artık veterinerlerle canlı video görüşmesi yapabilirsiniz. Premium üyelik ile sınırsız görüşme imkânı!',
   'owner', now() - interval '3 days'),
  ('Yeni Abonelik Planları',
   'Pro ve Premium planlarımızı güncelledik. Daha fazla hasta kapasitesi, öncelikli destek ve analitik araçlar için plan yükseltin.',
   'vet', now() - interval '1 day')
ON CONFLICT DO NOTHING;

-- ── Vet için çalışma saatleri (durmazcagatay@gmail.com) ─────────
INSERT INTO public.availability_slots (vet_id, day_of_week, start_time, end_time, is_active)
SELECT
  v.id,
  day,
  '09:00'::time,
  '17:00'::time,
  true
FROM public.veterinarians v
JOIN public.users u ON u.id = v.user_id
CROSS JOIN unnest(ARRAY[1,2,3,4,5]) AS day  -- Pazartesi-Cuma
WHERE u.email = 'durmazcagatay@gmail.com'
ON CONFLICT DO NOTHING;

-- ── Vet subscription kaydı ───────────────────────────────────────
INSERT INTO public.subscriptions (vet_id, tier, period, amount, status)
SELECT v.id, 'basic', 'monthly', 0, 'active'
FROM public.veterinarians v
JOIN public.users u ON u.id = v.user_id
WHERE u.email = 'durmazcagatay@gmail.com'
ON CONFLICT DO NOTHING;

-- ── Test veri ihlali bildirimi ───────────────────────────────────
INSERT INTO public.data_breach_notifications
  (description, severity, status, affected_users, notified_btk)
VALUES
  ('Test: Geliştirme ortamında simüle edilmiş veri ihlali bildirimi. Gerçek veri etkilenmedi.',
   'low', 'resolved', 0, false)
ON CONFLICT DO NOTHING;


-- ════════════════════════════════════════════════════════════════
-- BÖLÜM 3: KULLANICI BAĞIMLI TEST DATA
-- (Owner hesabı oluşturduktan sonra otomatik çalışır)
-- ════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_owner_id  uuid;
  v_vet_id    uuid;
  v_pet1_id   uuid;
  v_pet2_id   uuid;
BEGIN
  -- Owner: +owner alias ile kayıt olan kullanıcı
  -- Gmail trick: durmazcagatay+owner@gmail.com → aynı gelen kutusu, farklı hesap
  SELECT id INTO v_owner_id
  FROM public.users
  WHERE role = 'owner'
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT v.id INTO v_vet_id
  FROM public.veterinarians v
  JOIN public.users u ON u.id = v.user_id
  WHERE u.email = 'durmazcagatay@gmail.com'
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    RAISE NOTICE '⚠️  Owner hesabı yok. Siteye gidip /auth/register ile kayıt ol, sonra tekrar çalıştır.';
    RETURN;
  END IF;

  IF v_vet_id IS NULL THEN
    RAISE NOTICE '⚠️  Vet kaydı bulunamadı.';
    RETURN;
  END IF;

  -- Evcil hayvanlar
  INSERT INTO public.pets (owner_id, name, species, breed, birth_date, weight, gender, allergies)
  VALUES
    (v_owner_id, 'Pamuk', 'cat', 'Van Kedisi', '2021-03-15', 4.2, 'female', 'Polen'),
    (v_owner_id, 'Karabaş', 'dog', 'Golden Retriever', '2020-07-22', 28.5, 'male', NULL)
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_pet1_id FROM public.pets WHERE owner_id=v_owner_id AND name='Pamuk' LIMIT 1;
  SELECT id INTO v_pet2_id FROM public.pets WHERE owner_id=v_owner_id AND name='Karabaş' LIMIT 1;

  -- Randevular
  IF v_pet1_id IS NOT NULL THEN
    INSERT INTO public.appointments (owner_id, vet_id, pet_id, datetime, type, status, complaint)
    VALUES
      (v_owner_id, v_vet_id, v_pet1_id, now()+interval '2 days', 'video',     'confirmed', 'Yemek yemiyor, halsiz'),
      (v_owner_id, v_vet_id, v_pet1_id, now()+interval '7 days', 'video',     'pending',   'Rutin kontrol'),
      (v_owner_id, v_vet_id, v_pet2_id, now()-interval '5 days', 'in_person', 'completed', 'Aşı takvimi')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Aşılar
  IF v_pet1_id IS NOT NULL THEN
    INSERT INTO public.vaccines (pet_id, name, date_given, next_due_date, vet_name)
    VALUES
      (v_pet1_id, 'Karma Aşı', '2024-03-15', '2025-03-15', 'Dr. Cagatay Durmaz'),
      (v_pet1_id, 'Kuduz Aşısı', '2024-03-15', '2025-03-15', 'Dr. Cagatay Durmaz'),
      (v_pet2_id, 'Karma Aşı', '2023-07-22', '2024-07-22', 'Dr. Cagatay Durmaz')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Bildirimler
  INSERT INTO public.notifications (user_id, title, body, type, link)
  VALUES
    (v_owner_id, 'Randevunuz Onaylandı', 'Pamuk için video randevunuz onaylandı.', 'appointment', '/owner/appointments'),
    (v_owner_id, '⚠️ Aşı Hatırlatıcı', 'Karabaş''ın karma aşısı tarihi geçmiş!', 'reminder', '/owner/pets')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE '✅ Owner test verisi oluşturuldu. Owner ID: %', v_owner_id;
END $$;


-- ════════════════════════════════════════════════════════════════
-- BÖLÜM 4: VET ONAYLAMA + ADMIN ROLÜ
-- ════════════════════════════════════════════════════════════════

-- Vet'i onayla (test için)
UPDATE public.veterinarians
SET
  is_verified          = true,
  offers_video         = true,
  offers_in_person     = true,
  terms_accepted       = true,
  terms_accepted_at    = now(),
  kanun_5996_accepted  = true,
  specialty            = 'Genel Pratisyen',
  city                 = 'İstanbul',
  district             = 'Kadıköy',
  consultation_fee     = 300,
  video_consultation_fee = 240,
  bio                  = 'Evcil hayvan sağlığı konusunda 8 yıl deneyimli veteriner hekim.'
WHERE user_id = (SELECT id FROM public.users WHERE email='durmazcagatay@gmail.com');

-- ── ADMİN TEST: Aşağıdaki satırı çalıştır → test → geri al ──────
-- UPDATE public.users SET role='admin' WHERE email='durmazcagatay@gmail.com';
-- Test bitti → geri al:
-- UPDATE public.users SET role='vet'   WHERE email='durmazcagatay@gmail.com';


-- ════════════════════════════════════════════════════════════════
-- BÖLÜM 5: SONUÇ RAPORU
-- ════════════════════════════════════════════════════════════════
SELECT
  '📊 TABLO SAYILARI' as bilgi,
  (SELECT count(*) FROM public.users)                 as users,
  (SELECT count(*) FROM public.veterinarians)         as vets,
  (SELECT count(*) FROM public.pets)                  as pets,
  (SELECT count(*) FROM public.appointments)          as appointments,
  (SELECT count(*) FROM public.vaccines)              as vaccines,
  (SELECT count(*) FROM public.notifications)         as notifications,
  (SELECT count(*) FROM public.availability_slots)    as availability_slots,
  (SELECT count(*) FROM public.medical_records)       as medical_records,
  (SELECT count(*) FROM public.reviews)               as reviews,
  (SELECT count(*) FROM public.subscriptions)         as subscriptions,
  (SELECT count(*) FROM public.blog_posts)            as blog_posts,
  (SELECT count(*) FROM public.announcements)         as announcements,
  (SELECT count(*) FROM public.system_errors)         as system_errors,
  (SELECT count(*) FROM public.payments)              as payments;
