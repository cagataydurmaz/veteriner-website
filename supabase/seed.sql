-- =============================================
-- VetConnect Turkish Seed Data
-- =============================================

-- Note: Auth users must be created via Supabase Auth API
-- These inserts assume auth.users already has matching IDs

-- Insert specialty categories
INSERT INTO public.specialty_categories (name, is_active) VALUES
  ('Genel Veterinerlik', true),
  ('Küçük Hayvan Pratiği', true),
  ('Büyük Hayvan Pratiği', true),
  ('Egzotik Hayvanlar', true),
  ('Ortopedi ve Cerrahi', true),
  ('Dermatoloji', true),
  ('Onkoloji', true),
  ('Kardiyoloji', true),
  ('Nöroloji', true),
  ('Göz Hastalıkları', true),
  ('Diş Hekimliği', true),
  ('Beslenme ve Diyet', true),
  ('Davranış Bilimleri', true),
  ('Üreme ve Doğum', true),
  ('Acil ve Yoğun Bakım', true),
  ('Görüntüleme (Radyoloji)', true),
  ('İç Hastalıklar', true)
ON CONFLICT DO NOTHING;

-- =============================================
-- DEMO USERS (for testing)
-- =============================================
-- Admin user
INSERT INTO public.users (id, email, role, full_name, city) VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin@vetconnect.com', 'admin', 'VetConnect Admin', 'İstanbul')
ON CONFLICT (id) DO NOTHING;

-- Veterinarians
INSERT INTO public.users (id, email, role, full_name, city, phone) VALUES
  ('00000000-0000-0000-0000-000000000010', 'dr.ahmet@vetconnect.com', 'vet', 'Dr. Ahmet Kaya', 'İstanbul', '+905321234567'),
  ('00000000-0000-0000-0000-000000000011', 'dr.ayse@vetconnect.com', 'vet', 'Dr. Ayşe Demir', 'Ankara', '+905337654321'),
  ('00000000-0000-0000-0000-000000000012', 'dr.mehmet@vetconnect.com', 'vet', 'Dr. Mehmet Yıldız', 'İzmir', '+905359876543'),
  ('00000000-0000-0000-0000-000000000013', 'dr.fatma@vetconnect.com', 'vet', 'Dr. Fatma Şahin', 'Bursa', '+905361122334'),
  ('00000000-0000-0000-0000-000000000014', 'dr.can@vetconnect.com', 'vet', 'Dr. Can Öztürk', 'Antalya', '+905375544332')
ON CONFLICT (id) DO NOTHING;

-- Pet Owners
INSERT INTO public.users (id, email, role, full_name, city, phone) VALUES
  ('00000000-0000-0000-0000-000000000020', NULL, 'owner', 'Selin Arslan', 'İstanbul', '+905421234567'),
  ('00000000-0000-0000-0000-000000000021', NULL, 'owner', 'Murat Koç', 'İstanbul', '+905432345678'),
  ('00000000-0000-0000-0000-000000000022', NULL, 'owner', 'Zeynep Çelik', 'Ankara', '+905443456789'),
  ('00000000-0000-0000-0000-000000000023', NULL, 'owner', 'Emre Doğan', 'İzmir', '+905454567890')
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- VETERINARIAN PROFILES
-- =============================================
INSERT INTO public.veterinarians (id, user_id, license_number, specialty, city, district, bio, subscription_tier, is_verified, consultation_fee, video_consultation_fee, average_rating, total_reviews, is_online) VALUES
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000010',
    'VET-TR-12345',
    'Küçük Hayvan Pratiği',
    'İstanbul',
    'Kadıköy',
    'İstanbul Üniversitesi Veteriner Fakültesi mezunuyum. 10 yıldır Kadıköy''de kedi ve köpek sağlığı üzerine çalışıyorum. Özellikle iç hastalıklar ve önleyici tıp konularında uzmanım.',
    'premium',
    true,
    600.00,
    480.00,
    4.8,
    47,
    true
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000011',
    'VET-TR-23456',
    'Ortopedi ve Cerrahi',
    'Ankara',
    'Çankaya',
    'Ankara Üniversitesi mezunu, 8 yıllık tecrübeli ortopedi ve cerrahi uzmanı. Kırıklar, eklem sorunları ve yumuşak doku cerrahisi konularında uzmanlaşmış.',
    'pro',
    true,
    800.00,
    640.00,
    4.6,
    32,
    false
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000012',
    'VET-TR-34567',
    'Egzotik Hayvanlar',
    'İzmir',
    'Bornova',
    'Egzotik hayvanlar (kuş, sürüngen, tavşan, kemirgen) konusunda Türkiye''nin önde gelen uzmanlarından biri. 15 yıllık deneyim.',
    'premium',
    true,
    700.00,
    560.00,
    4.9,
    63,
    true
  ),
  (
    '10000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000013',
    'VET-TR-45678',
    'Dermatoloji',
    'Bursa',
    'Nilüfer',
    'Veteriner dermatoloji uzmanı. Deri hastalıkları, alerjiler ve dermatolojik cerrahi konusunda 7 yıllık tecrübe.',
    'basic',
    true,
    550.00,
    440.00,
    4.4,
    18,
    false
  ),
  (
    '10000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000014',
    'VET-TR-56789',
    'Genel Veterinerlik',
    'Antalya',
    'Muratpaşa',
    'Genel veteriner hekim. Aşılama, kontrol muayenesi ve temel sağlık hizmetleri sağlıyorum.',
    'pro',
    false,
    400.00,
    0.00,
    0.0,
    0,
    true
  )
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- AVAILABILITY SLOTS
-- =============================================
-- Dr. Ahmet (Mon-Sat 09:00-17:00)
INSERT INTO public.availability_slots (vet_id, day_of_week, start_time, end_time, is_active) VALUES
  ('10000000-0000-0000-0000-000000000001', 1, '09:00', '17:00', true),
  ('10000000-0000-0000-0000-000000000001', 2, '09:00', '17:00', true),
  ('10000000-0000-0000-0000-000000000001', 3, '09:00', '17:00', true),
  ('10000000-0000-0000-0000-000000000001', 4, '09:00', '17:00', true),
  ('10000000-0000-0000-0000-000000000001', 5, '09:00', '17:00', true),
  ('10000000-0000-0000-0000-000000000001', 6, '10:00', '14:00', true)
ON CONFLICT DO NOTHING;

-- Dr. Ayşe (Mon-Fri 10:00-18:00)
INSERT INTO public.availability_slots (vet_id, day_of_week, start_time, end_time, is_active) VALUES
  ('10000000-0000-0000-0000-000000000002', 1, '10:00', '18:00', true),
  ('10000000-0000-0000-0000-000000000002', 2, '10:00', '18:00', true),
  ('10000000-0000-0000-0000-000000000002', 3, '10:00', '18:00', true),
  ('10000000-0000-0000-0000-000000000002', 4, '10:00', '18:00', true),
  ('10000000-0000-0000-0000-000000000002', 5, '10:00', '18:00', true)
ON CONFLICT DO NOTHING;

-- =============================================
-- PETS
-- =============================================
INSERT INTO public.pets (id, owner_id, name, species, breed, birth_date, weight, allergies, chronic_conditions) VALUES
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000020', 'Karamel', 'Kedi', 'Scottish Fold', '2020-03-15', 4.2, NULL, NULL),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000020', 'Pamuk', 'Köpek', 'Poodle', '2019-07-22', 6.8, 'Tavuk etine karşı hafif intolerans', NULL),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000021', 'Zeus', 'Köpek', 'German Shepherd', '2018-11-05', 32.5, NULL, 'Kalça displazisi'),
  ('20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000022', 'Minnoş', 'Kedi', 'Van', '2021-05-10', 3.9, NULL, NULL),
  ('20000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000023', 'Maxi', 'Köpek', 'Labrador', '2017-09-18', 28.0, 'Polen alerjisi', 'Diyabet (kontrol altında)')
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- VACCINES
-- =============================================
INSERT INTO public.vaccines (pet_id, name, given_date, next_due_date, vet_id, notes) VALUES
  ('20000000-0000-0000-0000-000000000001', 'Karma Aşı (FVRCP)', '2024-01-15', '2025-01-15', '10000000-0000-0000-0000-000000000001', NULL),
  ('20000000-0000-0000-0000-000000000001', 'Kuduz Aşısı', '2024-01-15', '2025-01-15', '10000000-0000-0000-0000-000000000001', NULL),
  ('20000000-0000-0000-0000-000000000001', 'FeLV', '2023-06-20', '2024-06-20', '10000000-0000-0000-0000-000000000001', 'Geçmiş: Olumsuz test'),
  ('20000000-0000-0000-0000-000000000002', 'Karma Aşı (DHPP)', '2024-02-10', '2025-02-10', '10000000-0000-0000-0000-000000000001', NULL),
  ('20000000-0000-0000-0000-000000000002', 'Bordetella', '2024-02-10', '2025-02-10', '10000000-0000-0000-0000-000000000001', NULL),
  ('20000000-0000-0000-0000-000000000003', 'Karma Aşı (DHPP)', '2023-11-15', '2024-11-15', '10000000-0000-0000-0000-000000000002', NULL),
  ('20000000-0000-0000-0000-000000000003', 'Kuduz Aşısı', '2023-11-15', '2024-11-15', '10000000-0000-0000-0000-000000000002', NULL),
  ('20000000-0000-0000-0000-000000000004', 'Karma Aşı (FVRCP)', '2024-03-20', '2025-03-20', '10000000-0000-0000-0000-000000000001', NULL),
  ('20000000-0000-0000-0000-000000000005', 'Karma Aşı (DHPP)', '2024-04-05', '2025-04-05', '10000000-0000-0000-0000-000000000003', NULL)
ON CONFLICT DO NOTHING;

-- =============================================
-- WEIGHT LOGS
-- =============================================
INSERT INTO public.weight_logs (pet_id, weight, recorded_at) VALUES
  ('20000000-0000-0000-0000-000000000001', 3.8, '2023-09-01 10:00:00'),
  ('20000000-0000-0000-0000-000000000001', 3.9, '2023-12-01 10:00:00'),
  ('20000000-0000-0000-0000-000000000001', 4.1, '2024-03-01 10:00:00'),
  ('20000000-0000-0000-0000-000000000001', 4.2, '2024-06-01 10:00:00'),
  ('20000000-0000-0000-0000-000000000003', 30.0, '2023-06-01 10:00:00'),
  ('20000000-0000-0000-0000-000000000003', 31.5, '2023-09-01 10:00:00'),
  ('20000000-0000-0000-0000-000000000003', 32.0, '2023-12-01 10:00:00'),
  ('20000000-0000-0000-0000-000000000003', 32.5, '2024-03-01 10:00:00')
ON CONFLICT DO NOTHING;

-- =============================================
-- APPOINTMENTS
-- =============================================
INSERT INTO public.appointments (id, pet_id, vet_id, owner_id, datetime, type, status, complaint) VALUES
  (
    '30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000020',
    NOW() + INTERVAL '2 days' + INTERVAL '10 hours',
    'in_person',
    'confirmed',
    'Yıllık kontrol muayenesi ve aşı'
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000020',
    NOW() + INTERVAL '5 days' + INTERVAL '14 hours',
    'video',
    'pending',
    'Iştahsızlık şikayeti'
  ),
  (
    '30000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000021',
    NOW() - INTERVAL '1 month',
    'in_person',
    'completed',
    'Kalça muayenesi ve kontrol'
  )
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- MEDICAL RECORDS
-- =============================================
INSERT INTO public.medical_records (appointment_id, soap_notes, medications, follow_up_date, vet_notes) VALUES
  (
    '30000000-0000-0000-0000-000000000003',
    '{
      "subjective": "Sahip Zeus''un arka bacaklarında güçsüzlük olduğunu belirtiyor. 3 aydır merdiven çıkmakta zorlanıyor.",
      "objective": "Kalça ekleminde krepitasyon var. Orta düzey laksitiye. Vücut kondisyon skoru 5/9. Vital değerler normal.",
      "assessment": "Kalça displazisi - Orta evre. Artritik değişiklikler başlamış.",
      "plan": "Anti-inflamatuar ilaç tedavisi başlandı. Kilo kontrolü önerildi. 3 ayda bir kontrol randevusu."
    }',
    '[
      {"name": "Meloksikam", "dosage": "0.1 mg/kg", "duration": "30 gün", "instructions": "Yemekle birlikte verilecek"},
      {"name": "Omega-3 takviyesi", "dosage": "1 kapsül/gün", "duration": "Sürekli", "instructions": "Mama ile"}
    ]',
    (CURRENT_DATE + INTERVAL '3 months')::date,
    'Hasta iyi kontrol altında. Sahibine egzersiz kısıtlaması ve kilo yönetimi konusunda bilgi verildi.'
  )
ON CONFLICT (appointment_id) DO NOTHING;

-- =============================================
-- REVIEWS
-- =============================================
INSERT INTO public.reviews (vet_id, owner_id, appointment_id, rating, comment, is_approved) VALUES
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000020',
    NULL,
    5,
    'Dr. Ahmet gerçekten harika bir veteriner. Karamel''e çok iyi baktı, açıklamaları çok netti. Kesinlikle tavsiye ederim!',
    true
  ),
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000021',
    NULL,
    4,
    'Profesyonel ve ilgili. Randevu bekleme süresi biraz uzun ama hizmet kalitesi çok iyi.',
    true
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000021',
    '30000000-0000-0000-0000-000000000003',
    5,
    'Dr. Ayşe''nin Zeus''a yaptığı operasyon muhteşemdi. Çok profesyonel ve şefkatli. Takip sürecinde de çok yardımcı oldu.',
    true
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000023',
    NULL,
    5,
    'Egzotik hayvanlar konusunda Türkiye''nin en iyi veterinerlerinden. Maxi''min kuş tedavisini mükemmel yönetti.',
    true
  )
ON CONFLICT DO NOTHING;

-- =============================================
-- SUBSCRIPTIONS
-- =============================================
INSERT INTO public.subscriptions (vet_id, tier, status, start_date, next_billing_date) VALUES
  ('10000000-0000-0000-0000-000000000001', 'premium', 'active', CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE + INTERVAL '15 days'),
  ('10000000-0000-0000-0000-000000000002', 'pro', 'active', CURRENT_DATE - INTERVAL '20 days', CURRENT_DATE + INTERVAL '10 days'),
  ('10000000-0000-0000-0000-000000000003', 'premium', 'active', CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE + INTERVAL '25 days'),
  ('10000000-0000-0000-0000-000000000004', 'basic', 'active', CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE)
ON CONFLICT DO NOTHING;

-- =============================================
-- NOTIFICATIONS
-- =============================================
INSERT INTO public.notifications (user_id, title, body, is_read) VALUES
  ('00000000-0000-0000-0000-000000000020', 'Randevunuz Onaylandı', 'Karamel için Dr. Ahmet Kaya ile randevunuz onaylandı.', false),
  ('00000000-0000-0000-0000-000000000020', 'Aşı Hatırlatıcısı', 'Karamel''in FeLV aşısı tarihi geçmiş. Lütfen randevu alın.', false),
  ('00000000-0000-0000-0000-000000000021', 'Randevu Tamamlandı', 'Zeus için randevunuz tamamlandı. Tıbbi notlar hazır.', true),
  ('00000000-0000-0000-0000-000000000010', 'Yeni Randevu Talebi', 'Selin Arslan, Pamuk için video randevusu talep etti.', false)
ON CONFLICT DO NOTHING;

-- =============================================
-- ANNOUNCEMENTS
-- =============================================
INSERT INTO public.announcements (title, body, target_role, created_by, sent_at) VALUES
  (
    'VetConnect''e Hoş Geldiniz!',
    'Türkiye''nin en kapsamlı veteriner platformuna hoş geldiniz. Sorularınız için destek@vetconnect.com adresine yazabilirsiniz.',
    'all',
    '00000000-0000-0000-0000-000000000001',
    NOW()
  ),
  (
    'Yeni Özellik: Video Konsültasyon',
    'Premium plan veterinerlerinizle artık video görüşme yapabilirsiniz. Detaylı bilgi için profil sayfasını ziyaret edin.',
    'owner',
    '00000000-0000-0000-0000-000000000001',
    NOW()
  )
ON CONFLICT DO NOTHING;

-- =============================================
-- SYMPTOM CHECK SAMPLES
-- =============================================
INSERT INTO public.symptom_checks (owner_id, pet_id, symptoms_text, urgency_level, ai_response) VALUES
  (
    '00000000-0000-0000-0000-000000000020',
    '20000000-0000-0000-0000-000000000001',
    'Kedim 2 gündür iştahsız ve sürekli uyuyor. Lavaboya gitmediğini fark ettim.',
    'high',
    '{
      "urgency_level": "high",
      "urgency_label_tr": "Bugün Git",
      "recommended_specialist": "Küçük Hayvan Pratiği veya İç Hastalıklar Uzmanı",
      "what_not_to_do": ["Evde ilaç vermeyin", "Zorla yedirmeye çalışmayın", "Bekleyip görelim yapmayın"],
      "general_guidance": "İştahsızlık ve idrar yapamamak, özellikle erkek kedilerde çok ciddi bir durum olabilir. Bugün veterinere götürmenizi öneririm.",
      "disclaimer": "Bu bir ön değerlendirmedir, kesin tanı değildir. Lütfen bir veterinere danışınız."
    }'
  )
ON CONFLICT DO NOTHING;

-- Log sample API usage
INSERT INTO public.api_usage_logs (api_type, tokens_used, cost_estimate) VALUES
  ('claude', 1250, 0.0156),
  ('claude', 980, 0.0122),
  ('whisper', 150, 0.009),
  ('whatsapp', NULL, 0.05),
  ('whatsapp', NULL, 0.05),
  ('claude', 2100, 0.0263)
ON CONFLICT DO NOTHING;

COMMIT;
