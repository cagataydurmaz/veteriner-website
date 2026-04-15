-- ============================================================
-- VetBul — TAM SCHEMA (Tek Seferde Çalıştır)
-- Mevcut tablolara dokunmaz, sadece eksikleri oluşturur
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. NOTIFICATIONS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  title      text not null,
  body       text not null,
  type       text default 'info'
    check (type in ('info','appointment','reminder','payment','system')),
  is_read    boolean default false,
  link       text,
  created_at timestamptz default now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user     ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread   ON public.notifications(user_id, is_read) WHERE is_read = false;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notifications' AND policyname='User manages own notifications') THEN
    CREATE POLICY "User manages own notifications" ON public.notifications FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 2. AVAILABILITY SLOTS (Vet çalışma saatleri)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.availability_slots (
  id           uuid primary key default gen_random_uuid(),
  vet_id       uuid not null references public.veterinarians(id) on delete cascade,
  day_of_week  integer not null check (day_of_week between 0 and 6),
  start_time   time not null,
  end_time     time not null,
  is_active    boolean default true,
  created_at   timestamptz default now()
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
      EXISTS (SELECT 1 FROM public.veterinarians v WHERE v.id = vet_id AND v.user_id = auth.uid())
    );
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 3. MEDICAL RECORDS (SOAP notları, ilaçlar, sesli not)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.medical_records (
  id               uuid primary key default gen_random_uuid(),
  appointment_id   uuid not null references public.appointments(id) on delete cascade unique,
  pet_id           uuid references public.pets(id) on delete set null,
  vet_id           uuid references public.veterinarians(id) on delete set null,
  voice_note_url   text,
  transcription    text,
  soap_notes       jsonb,
  medications      jsonb,
  follow_up_date   date,
  vet_notes        text,
  is_private       boolean default false,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);
CREATE INDEX IF NOT EXISTS idx_medical_records_pet  ON public.medical_records(pet_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_vet  ON public.medical_records(vet_id);
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='medical_records' AND policyname='Vet manages own records') THEN
    CREATE POLICY "Vet manages own records" ON public.medical_records FOR ALL USING (
      EXISTS (SELECT 1 FROM public.veterinarians v WHERE v.id = vet_id AND v.user_id = auth.uid())
    );
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='medical_records' AND policyname='Owner reads own pet records') THEN
    CREATE POLICY "Owner reads own pet records" ON public.medical_records FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.owner_id = auth.uid())
      AND is_private = false
    );
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 4. REVIEWS (Sahipten veterinere değerlendirme)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reviews (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments(id) on delete set null unique,
  vet_id         uuid not null references public.veterinarians(id) on delete cascade,
  owner_id       uuid not null references public.users(id) on delete cascade,
  rating         integer not null check (rating between 1 and 5),
  comment        text,
  is_approved    boolean default false,
  is_flagged     boolean default false,
  created_at     timestamptz default now()
);
CREATE INDEX IF NOT EXISTS idx_reviews_vet   ON public.reviews(vet_id);
CREATE INDEX IF NOT EXISTS idx_reviews_owner ON public.reviews(owner_id);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reviews' AND policyname='Owner submits own reviews') THEN
    CREATE POLICY "Owner submits own reviews" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = owner_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reviews' AND policyname='Public reads approved reviews') THEN
    CREATE POLICY "Public reads approved reviews" ON public.reviews FOR SELECT USING (is_approved = true OR auth.uid() = owner_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reviews' AND policyname='Admin manages reviews') THEN
    CREATE POLICY "Admin manages reviews" ON public.reviews FOR ALL USING (
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 5. SUBSCRIPTIONS (Veteriner abonelik geçmişi)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                      uuid primary key default gen_random_uuid(),
  vet_id                  uuid not null references public.veterinarians(id) on delete cascade,
  tier                    text not null check (tier in ('basic','pro','premium')),
  status                  text not null default 'active'
    check (status in ('active','cancelled','past_due','trialing')),
  iyzico_subscription_id  text,
  start_date              date not null default current_date,
  next_billing_date       date,
  cancelled_at            timestamptz,
  created_at              timestamptz default now()
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_vet ON public.subscriptions(vet_id);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='subscriptions' AND policyname='Vet reads own subscriptions') THEN
    CREATE POLICY "Vet reads own subscriptions" ON public.subscriptions FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.veterinarians v WHERE v.id = vet_id AND v.user_id = auth.uid())
    );
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='subscriptions' AND policyname='Admin reads all subscriptions') THEN
    CREATE POLICY "Admin reads all subscriptions" ON public.subscriptions FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 6. REMINDERS (Aşı / ilaç / kontrol hatırlatıcıları)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reminders (
  id               uuid primary key default gen_random_uuid(),
  pet_id           uuid not null references public.pets(id) on delete cascade,
  owner_id         uuid not null references public.users(id) on delete cascade,
  type             text not null check (type in ('vaccine','checkup','medication','appointment')),
  title            text not null,
  scheduled_at     timestamptz not null,
  sent_at          timestamptz,
  message_content  text,
  delivery_status  text default 'pending' check (delivery_status in ('pending','sent','failed')),
  created_at       timestamptz default now()
);
CREATE INDEX IF NOT EXISTS idx_reminders_owner    ON public.reminders(owner_id);
CREATE INDEX IF NOT EXISTS idx_reminders_pending  ON public.reminders(delivery_status, scheduled_at) WHERE delivery_status = 'pending';
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reminders' AND policyname='Owner manages own reminders') THEN
    CREATE POLICY "Owner manages own reminders" ON public.reminders FOR ALL USING (auth.uid() = owner_id);
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 7. SYMPTOM CHECKS (AI semptom sorguları)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.symptom_checks (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.users(id) on delete cascade,
  pet_id         uuid references public.pets(id) on delete set null,
  symptoms_text  text not null,
  photo_url      text,
  ai_response    jsonb,
  urgency_level  text check (urgency_level in ('low','medium','high','emergency')),
  created_at     timestamptz default now()
);
CREATE INDEX IF NOT EXISTS idx_symptom_checks_owner ON public.symptom_checks(owner_id);
ALTER TABLE public.symptom_checks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='symptom_checks' AND policyname='Owner manages own checks') THEN
    CREATE POLICY "Owner manages own checks" ON public.symptom_checks FOR ALL USING (auth.uid() = owner_id);
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 8. WEIGHT LOGS (Pet kilo takibi)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.weight_logs (
  id          uuid primary key default gen_random_uuid(),
  pet_id      uuid not null references public.pets(id) on delete cascade,
  weight      numeric(5,2) not null,
  recorded_at timestamptz default now(),
  notes       text
);
CREATE INDEX IF NOT EXISTS idx_weight_logs_pet ON public.weight_logs(pet_id, recorded_at);
ALTER TABLE public.weight_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='weight_logs' AND policyname='Owner manages pet weight') THEN
    CREATE POLICY "Owner manages pet weight" ON public.weight_logs FOR ALL USING (
      EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.owner_id = auth.uid())
    );
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 9. PET PHOTOS (Pet fotoğraf galerisi)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pet_photos (
  id          uuid primary key default gen_random_uuid(),
  pet_id      uuid not null references public.pets(id) on delete cascade,
  photo_url   text not null,
  visit_date  date,
  caption     text,
  created_at  timestamptz default now()
);
CREATE INDEX IF NOT EXISTS idx_pet_photos_pet ON public.pet_photos(pet_id);
ALTER TABLE public.pet_photos ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pet_photos' AND policyname='Owner manages pet photos') THEN
    CREATE POLICY "Owner manages pet photos" ON public.pet_photos FOR ALL USING (
      EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.owner_id = auth.uid())
    );
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 10. DISPUTES (Değerlendirme anlaşmazlıkları)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.disputes (
  id             uuid primary key default gen_random_uuid(),
  review_id      uuid not null references public.reviews(id) on delete cascade,
  vet_id         uuid not null references public.veterinarians(id) on delete cascade,
  reason         text not null,
  status         text not null default 'pending'
    check (status in ('pending','reviewing','resolved','dismissed')),
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
      EXISTS (SELECT 1 FROM public.veterinarians v WHERE v.id = vet_id AND v.user_id = auth.uid())
    );
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='disputes' AND policyname='Admin manages disputes') THEN
    CREATE POLICY "Admin manages disputes" ON public.disputes FOR ALL USING (
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 11. ANNOUNCEMENTS (Admin duyuruları)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.announcements (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text not null,
  target_role text not null default 'all'
    check (target_role in ('all','owner','vet')),
  sent_at     timestamptz,
  created_by  uuid references public.users(id) on delete set null,
  created_at  timestamptz default now()
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='announcements' AND policyname='Public reads announcements') THEN
    CREATE POLICY "Public reads announcements" ON public.announcements FOR SELECT USING (sent_at IS NOT NULL);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='announcements' AND policyname='Admin manages announcements') THEN
    CREATE POLICY "Admin manages announcements" ON public.announcements FOR ALL USING (
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 12. API USAGE LOGS (Claude / Whisper / WhatsApp maliyet takibi)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.api_usage_logs (
  id             uuid primary key default gen_random_uuid(),
  api_type       text not null check (api_type in ('claude','whisper','whatsapp','agora')),
  user_id        uuid references public.users(id) on delete set null,
  tokens_used    integer,
  cost_estimate  numeric(10,4),
  endpoint       text,
  created_at     timestamptz default now()
);
CREATE INDEX IF NOT EXISTS idx_api_usage_type ON public.api_usage_logs(api_type, created_at);
ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='api_usage_logs' AND policyname='Admin reads api logs') THEN
    CREATE POLICY "Admin reads api logs" ON public.api_usage_logs FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 13. BLOG POSTS (Admin içerik yönetimi)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  title       text not null,
  excerpt     text,
  content     text not null,
  cover_image text,
  author_id   uuid references public.users(id) on delete set null,
  tags        text[] default '{}',
  is_published boolean default false,
  published_at timestamptz,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
CREATE INDEX IF NOT EXISTS idx_blog_slug      ON public.blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_published ON public.blog_posts(is_published, published_at);
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='blog_posts' AND policyname='Public reads published posts') THEN
    CREATE POLICY "Public reads published posts" ON public.blog_posts FOR SELECT USING (is_published = true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='blog_posts' AND policyname='Admin manages blog posts') THEN
    CREATE POLICY "Admin manages blog posts" ON public.blog_posts FOR ALL USING (
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 14. VIOLATION REPORTS (Sahip → Vet şikayeti)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.violation_reports (
  id             uuid primary key default gen_random_uuid(),
  reporter_id    uuid not null references public.users(id),
  vet_id         uuid not null references public.veterinarians(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  reason         text not null check (reason in (
    'platform_disina_yonlendirdi','iletisim_bilgisi_paylasti',
    'uygunsuz_davranis','diger'
  )),
  details        text,
  status         text default 'pending'
    check (status in ('pending','reviewed','actioned','dismissed')),
  admin_note     text,
  created_at     timestamptz default now(),
  reviewed_at    timestamptz
);
CREATE INDEX IF NOT EXISTS idx_violation_vet    ON public.violation_reports(vet_id);
CREATE INDEX IF NOT EXISTS idx_violation_status ON public.violation_reports(status);
ALTER TABLE public.violation_reports ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='violation_reports' AND policyname='Owner submits reports') THEN
    CREATE POLICY "Owner submits reports" ON public.violation_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='violation_reports' AND policyname='Owner reads own reports') THEN
    CREATE POLICY "Owner reads own reports" ON public.violation_reports FOR SELECT USING (auth.uid() = reporter_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='violation_reports' AND policyname='Admin manages violation reports') THEN
    CREATE POLICY "Admin manages violation reports" ON public.violation_reports FOR ALL USING (
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 15. FRAUD FLAGS (Otomatik sahtekarlık tespiti)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fraud_flags (
  id              uuid primary key default gen_random_uuid(),
  vet_id          uuid not null references public.veterinarians(id) on delete cascade,
  flag_type       text not null check (flag_type in (
    'repeated_cancellations_pair','high_cancellation_rate','no_completions_30days'
  )),
  details         jsonb default '{}',
  is_resolved     boolean default false,
  admin_notified  boolean default false,
  created_at      timestamptz default now(),
  resolved_at     timestamptz
);
CREATE INDEX IF NOT EXISTS idx_fraud_vet      ON public.fraud_flags(vet_id);
CREATE INDEX IF NOT EXISTS idx_fraud_resolved ON public.fraud_flags(is_resolved);
ALTER TABLE public.fraud_flags ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fraud_flags' AND policyname='Admin manages fraud flags') THEN
    CREATE POLICY "Admin manages fraud flags" ON public.fraud_flags FOR ALL USING (
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 16. ÖZET
-- ────────────────────────────────────────────────────────────
SELECT
  (SELECT count(*) FROM public.notifications)        as notifications,
  (SELECT count(*) FROM public.availability_slots)   as availability_slots,
  (SELECT count(*) FROM public.medical_records)      as medical_records,
  (SELECT count(*) FROM public.reviews)              as reviews,
  (SELECT count(*) FROM public.subscriptions)        as subscriptions,
  (SELECT count(*) FROM public.reminders)            as reminders,
  (SELECT count(*) FROM public.symptom_checks)       as symptom_checks,
  (SELECT count(*) FROM public.weight_logs)          as weight_logs,
  (SELECT count(*) FROM public.pet_photos)           as pet_photos,
  (SELECT count(*) FROM public.disputes)             as disputes,
  (SELECT count(*) FROM public.announcements)        as announcements,
  (SELECT count(*) FROM public.api_usage_logs)       as api_usage_logs,
  (SELECT count(*) FROM public.blog_posts)           as blog_posts,
  (SELECT count(*) FROM public.violation_reports)    as violation_reports,
  (SELECT count(*) FROM public.fraud_flags)          as fraud_flags;
