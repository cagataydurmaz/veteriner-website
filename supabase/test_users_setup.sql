-- =============================================================================
-- VetBul — Test Kullanıcıları Kurulum SQL
-- Supabase Dashboard > SQL Editor'da çalıştır
--
-- ÖNCESİNDE:
--   Auth > Users > "Add user" ile aşağıdaki kullanıcıları manuel oluştur:
--   (E-posta + Şifre yöntemi, "Auto confirm email" AÇIK olmalı)
--
--   1. vb.owner.email@mailinator.com   / herhangi şifre (OTP kullanıcısı)
--   2. vb.vet.active@mailinator.com    / VbTest2026!
--   3. vb.vet.pending@mailinator.com   / VbTest2026!
--   4. vb.vet.suspended@mailinator.com / VbTest2026!
--   5. vb.vet.banned@mailinator.com    / VbTest2026!
--
-- Bu SQL: public.users + veterinarians satırlarını oluşturur.
-- =============================================================================

-- ── 1. OWNER — E-posta OTP kullanıcısı ───────────────────────────────────────
INSERT INTO public.users (id, email, full_name, role, city)
SELECT
  au.id,
  'vb.owner.email@mailinator.com',
  'Test Owner Email',
  'owner',
  'İstanbul'
FROM auth.users au
WHERE au.email = 'vb.owner.email@mailinator.com'
ON CONFLICT (id) DO UPDATE
  SET full_name = 'Test Owner Email', role = 'owner', city = 'İstanbul';

-- ── 2. OWNER — Telefon OTP kullanıcısı ──────────────────────────────────────
--    Telefon numarası Supabase'de Auth > Settings > Phone Auth >
--    "Test phone numbers" bölümüne eklenmeli: +905550000001 → OTP: 123456
--    Bu satır zaten telefon kayıt akışında otomatik oluşur.
--    Manuel oluşturmak için:
-- INSERT INTO public.users (id, phone, full_name, role, city)
-- VALUES (gen_random_uuid(), '+905550000001', 'Test Owner Phone', 'owner', 'Ankara')
-- ON CONFLICT DO NOTHING;

-- ── 3. VET — Aktif & Onaylı ───────────────────────────────────────────────────
INSERT INTO public.users (id, email, full_name, role, city)
SELECT
  au.id,
  'vb.vet.active@mailinator.com',
  'Dr. Test Aktif',
  'vet',
  'İstanbul'
FROM auth.users au
WHERE au.email = 'vb.vet.active@mailinator.com'
ON CONFLICT (id) DO UPDATE
  SET full_name = 'Dr. Test Aktif', role = 'vet', city = 'İstanbul';

INSERT INTO public.veterinarians (
  user_id, specialty, city, subscription_tier,
  is_verified, offers_in_person, consultation_fee, video_consultation_fee
)
SELECT
  au.id,
  'Genel Pratisyen',
  'İstanbul',
  'basic',
  true,      -- onaylı
  true,
  300,
  250
FROM auth.users au
WHERE au.email = 'vb.vet.active@mailinator.com'
ON CONFLICT (user_id) DO UPDATE
  SET is_verified = true, is_banned = false, suspension_until = NULL;

-- ── 4. VET — Onay Bekleyen (is_verified = false) ──────────────────────────────
INSERT INTO public.users (id, email, full_name, role, city)
SELECT
  au.id,
  'vb.vet.pending@mailinator.com',
  'Dr. Test Bekleyen',
  'vet',
  'Ankara'
FROM auth.users au
WHERE au.email = 'vb.vet.pending@mailinator.com'
ON CONFLICT (id) DO UPDATE
  SET full_name = 'Dr. Test Bekleyen', role = 'vet', city = 'Ankara';

INSERT INTO public.veterinarians (
  user_id, specialty, city, subscription_tier,
  is_verified, offers_in_person, consultation_fee, video_consultation_fee
)
SELECT
  au.id,
  'Dahiliye',
  'Ankara',
  'basic',
  false,     -- onay bekliyor
  true,
  200,
  200
FROM auth.users au
WHERE au.email = 'vb.vet.pending@mailinator.com'
ON CONFLICT (user_id) DO UPDATE
  SET is_verified = false, is_banned = false, suspension_until = NULL;

-- ── 5. VET — Askıya Alınmış (suspension_until = gelecek) ─────────────────────
INSERT INTO public.users (id, email, full_name, role, city)
SELECT
  au.id,
  'vb.vet.suspended@mailinator.com',
  'Dr. Test Askıda',
  'vet',
  'İzmir'
FROM auth.users au
WHERE au.email = 'vb.vet.suspended@mailinator.com'
ON CONFLICT (id) DO UPDATE
  SET full_name = 'Dr. Test Askıda', role = 'vet', city = 'İzmir';

INSERT INTO public.veterinarians (
  user_id, specialty, city, subscription_tier,
  is_verified, offers_in_person, consultation_fee, video_consultation_fee,
  suspension_until, violation_count
)
SELECT
  au.id,
  'Cerrahi',
  'İzmir',
  'basic',
  true,
  true,
  350,
  300,
  now() + interval '6 days',   -- 6 gün daha askıda
  1
FROM auth.users au
WHERE au.email = 'vb.vet.suspended@mailinator.com'
ON CONFLICT (user_id) DO UPDATE
  SET
    is_verified     = true,
    is_banned       = false,
    suspension_until = now() + interval '6 days',
    violation_count  = 1;

-- ── 6. VET — Kalıcı Yasaklı (is_banned = true) ───────────────────────────────
INSERT INTO public.users (id, email, full_name, role, city)
SELECT
  au.id,
  'vb.vet.banned@mailinator.com',
  'Dr. Test Yasaklı',
  'vet',
  'Bursa'
FROM auth.users au
WHERE au.email = 'vb.vet.banned@mailinator.com'
ON CONFLICT (id) DO UPDATE
  SET full_name = 'Dr. Test Yasaklı', role = 'vet', city = 'Bursa';

INSERT INTO public.veterinarians (
  user_id, specialty, city, subscription_tier,
  is_verified, offers_in_person, consultation_fee, video_consultation_fee,
  is_banned, violation_count
)
SELECT
  au.id,
  'Dermatoloji',
  'Bursa',
  'basic',
  true,
  true,
  400,
  350,
  true,      -- kalıcı ban
  3
FROM auth.users au
WHERE au.email = 'vb.vet.banned@mailinator.com'
ON CONFLICT (user_id) DO UPDATE
  SET is_verified = true, is_banned = true, suspension_until = NULL, violation_count = 3;

-- ── Doğrulama: Tüm test kullanıcılarını göster ────────────────────────────────
SELECT
  u.email,
  u.phone,
  u.role,
  u.city,
  v.is_verified,
  v.is_banned,
  v.suspension_until,
  v.specialty
FROM public.users u
LEFT JOIN public.veterinarians v ON v.user_id = u.id
WHERE u.email LIKE 'vb.%@mailinator.com'
   OR u.phone = '+905550000001'
ORDER BY u.role, u.email;
