-- ============================================================
-- VetBul — Test Setup (tüm paneller)
-- Supabase SQL Editor'da çalıştır
-- ============================================================

-- ── Mevcut hesapları göster ──────────────────────────────────
SELECT id, email, role FROM public.users ORDER BY created_at;

-- ── 1. ADMİN: durmazcagatay@gmail.com'u admin yap ──────────
-- (test bittikten sonra tekrar vet yapacağız)
-- UPDATE public.users SET role = 'admin' WHERE email = 'durmazcagatay@gmail.com';

-- ── 2. OWNER hesabına evcil hayvan ekle ─────────────────────
-- (NULL email'li hesabın id'sini bul)
DO $$
DECLARE
  v_owner_id uuid;
  v_pet_id   uuid;
  v_vet_id   uuid;
BEGIN
  -- NULL email'li owner'ı bul
  SELECT id INTO v_owner_id FROM public.users
  WHERE email IS NULL AND role = 'owner'
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    RAISE NOTICE 'Owner hesabı bulunamadı, atlanıyor...';
    RETURN;
  END IF;

  -- Vet'i bul
  SELECT v.id INTO v_vet_id FROM public.veterinarians v
  JOIN public.users u ON u.id = v.user_id
  WHERE u.email = 'durmazcagatay@gmail.com'
  LIMIT 1;

  -- Evcil hayvan ekle (yoksa)
  INSERT INTO public.pets (owner_id, name, species, breed, birth_date, weight, gender)
  VALUES
    (v_owner_id, 'Pamuk', 'cat', 'Van Kedisi', '2021-03-15', 4.2, 'female'),
    (v_owner_id, 'Karabaş', 'dog', 'Golden Retriever', '2020-07-22', 28.5, 'male')
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_pet_id;

  -- İlk evcil hayvanın id'sini al
  SELECT id INTO v_pet_id FROM public.pets WHERE owner_id = v_owner_id LIMIT 1;

  -- Test randevusu ekle (owner + vet + pet)
  IF v_vet_id IS NOT NULL AND v_pet_id IS NOT NULL THEN
    INSERT INTO public.appointments (owner_id, vet_id, pet_id, datetime, type, status, complaint)
    VALUES
      (v_owner_id, v_vet_id, v_pet_id,
       now() + interval '2 days',
       'video', 'confirmed', 'Yemek yemiyor, halsiz görünüyor'),
      (v_owner_id, v_vet_id, v_pet_id,
       now() - interval '5 days',
       'in_person', 'completed', 'Rutin kontrol')
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Test randevuları oluşturuldu.';
  ELSE
    RAISE NOTICE 'Vet veya pet bulunamadı, randevu oluşturulamadı.';
  END IF;

  RAISE NOTICE 'Owner setup tamamlandı. Owner ID: %', v_owner_id;
END $$;

-- ── 3. VET hesabı kontrol ────────────────────────────────────
SELECT
  u.email,
  u.role,
  v.id as vet_id,
  v.specialty,
  v.city,
  v.subscription_tier,
  v.offers_in_person,
  v.offers_video
FROM public.users u
LEFT JOIN public.veterinarians v ON v.user_id = u.id
WHERE u.email = 'durmazcagatay@gmail.com';

-- ── 4. Tüm tabloları kontrol et ──────────────────────────────
SELECT
  (SELECT count(*) FROM public.users)        as users,
  (SELECT count(*) FROM public.veterinarians) as vets,
  (SELECT count(*) FROM public.pets)          as pets,
  (SELECT count(*) FROM public.appointments)  as appointments;
