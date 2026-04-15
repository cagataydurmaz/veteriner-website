-- ============================================================
-- VetBul — COMPLETE RLS (Granüler, Production-Ready)
-- Mevcut tüm policy'leri sıfırlayıp doğru şekilde yazar
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- USERS
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User reads own row"         ON public.users;
DROP POLICY IF EXISTS "User updates own row"        ON public.users;
DROP POLICY IF EXISTS "Admin reads all users"       ON public.users;

CREATE POLICY "User reads own row"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "User updates own row"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admin: service role bypasses RLS — anon/authenticated erişemez

-- ════════════════════════════════════════════════════════════
-- PETS
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner manages own pets"       ON public.pets;
DROP POLICY IF EXISTS "Vet reads appointment pets"   ON public.pets;

-- Sahip tüm işlemleri yapabilir
CREATE POLICY "Owner manages own pets"
  ON public.pets FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Vet sadece aktif randevusu olan peti okuyabilir (edit/delete yok)
CREATE POLICY "Vet reads appointment pets"
  ON public.pets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      JOIN public.veterinarians v ON v.id = a.vet_id
      WHERE a.pet_id = pets.id
        AND v.user_id = auth.uid()
        AND a.status != 'cancelled'
    )
  );

-- ════════════════════════════════════════════════════════════
-- VETERINARIANS
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.veterinarians ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public reads verified vets"   ON public.veterinarians;
DROP POLICY IF EXISTS "Vet reads own profile"        ON public.veterinarians;
DROP POLICY IF EXISTS "Vet updates own profile"      ON public.veterinarians;
DROP POLICY IF EXISTS "Admin reads all vets"         ON public.veterinarians;
DROP POLICY IF EXISTS "Admin updates vets"           ON public.veterinarians;
DROP POLICY IF EXISTS "Vet insert own profile"       ON public.veterinarians;
DROP POLICY IF EXISTS "vet_insert_own_profile"       ON public.veterinarians;
DROP POLICY IF EXISTS "vet_update_own_profile"       ON public.veterinarians;
DROP POLICY IF EXISTS "vet_select_own_profile"       ON public.veterinarians;

-- Herkese açık: sadece onaylı vet profilleri
CREATE POLICY "Public reads verified vets"
  ON public.veterinarians FOR SELECT
  USING (is_verified = true OR user_id = auth.uid());

-- Vet kendi profilini okur/günceller
CREATE POLICY "Vet manages own profile"
  ON public.veterinarians FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ════════════════════════════════════════════════════════════
-- APPOINTMENTS
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner reads own appointments"    ON public.appointments;
DROP POLICY IF EXISTS "Owner creates appointments"      ON public.appointments;
DROP POLICY IF EXISTS "Owner cancels own appointments"  ON public.appointments;
DROP POLICY IF EXISTS "Vet reads own appointments"      ON public.appointments;
DROP POLICY IF EXISTS "Vet updates appointment status"  ON public.appointments;
DROP POLICY IF EXISTS "Admin reads all appointments"    ON public.appointments;

-- Owner: kendi randevularını okur
CREATE POLICY "Owner reads own appointments"
  ON public.appointments FOR SELECT
  USING (auth.uid() = owner_id);

-- Owner: randevu oluşturur
CREATE POLICY "Owner creates appointments"
  ON public.appointments FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- Owner: sadece kendi randevusunu iptal eder (24 saat kuralı uygulama katmanında)
CREATE POLICY "Owner cancels own appointments"
  ON public.appointments FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id AND status = 'cancelled');

-- Vet: kendine atanmış randevuları okur
CREATE POLICY "Vet reads own appointments"
  ON public.appointments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.veterinarians v
      WHERE v.id = vet_id AND v.user_id = auth.uid()
    )
  );

-- Vet: status güncelleyebilir (confirmed, completed, no_show)
CREATE POLICY "Vet updates appointment status"
  ON public.appointments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.veterinarians v
      WHERE v.id = vet_id AND v.user_id = auth.uid()
    )
  );

-- ════════════════════════════════════════════════════════════
-- MEDICAL RECORDS
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vet manages own records"       ON public.medical_records;
DROP POLICY IF EXISTS "Owner reads own pet records"   ON public.medical_records;
DROP POLICY IF EXISTS "Admin reads medical records"   ON public.medical_records;

-- Vet: kendi randevusuna ait kayıtları CRUD
CREATE POLICY "Vet manages own records"
  ON public.medical_records FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      JOIN public.veterinarians v ON v.id = a.vet_id
      WHERE a.id = appointment_id AND v.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.appointments a
      JOIN public.veterinarians v ON v.id = a.vet_id
      WHERE a.id = appointment_id AND v.user_id = auth.uid()
    )
  );

-- Owner: sadece kendi petinin kayıtlarını okur
CREATE POLICY "Owner reads own pet records"
  ON public.medical_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      JOIN public.pets p ON p.id = a.pet_id
      WHERE a.id = appointment_id AND p.owner_id = auth.uid()
    )
    AND is_private = false
  );

-- ════════════════════════════════════════════════════════════
-- VACCINES
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.vaccines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner manages vaccines"   ON public.vaccines;
DROP POLICY IF EXISTS "Vet inserts vaccines"     ON public.vaccines;
DROP POLICY IF EXISTS "Vet reads patient vaccines" ON public.vaccines;

-- Owner: kendi petinin aşılarını okur
CREATE POLICY "Owner reads own vaccines"
  ON public.vaccines FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.owner_id = auth.uid())
  );

-- Vet: randevusu olan pet için aşı ekler
CREATE POLICY "Vet inserts vaccines"
  ON public.vaccines FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.appointments a
      JOIN public.veterinarians v ON v.id = a.vet_id
      WHERE a.pet_id = pet_id AND v.user_id = auth.uid() AND a.status != 'cancelled'
    )
  );

-- Vet: randevusu olan petin aşılarını okur
CREATE POLICY "Vet reads patient vaccines"
  ON public.vaccines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      JOIN public.veterinarians v ON v.id = a.vet_id
      WHERE a.pet_id = pet_id AND v.user_id = auth.uid() AND a.status != 'cancelled'
    )
  );

-- ════════════════════════════════════════════════════════════
-- WEIGHT LOGS
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.weight_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner manages weight"        ON public.weight_logs;
DROP POLICY IF EXISTS "Vet reads patient weight"    ON public.weight_logs;

CREATE POLICY "Owner manages weight"
  ON public.weight_logs FOR ALL
  USING (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.owner_id = auth.uid()));

CREATE POLICY "Vet reads patient weight"
  ON public.weight_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      JOIN public.veterinarians v ON v.id = a.vet_id
      WHERE a.pet_id = pet_id AND v.user_id = auth.uid() AND a.status != 'cancelled'
    )
  );

-- ════════════════════════════════════════════════════════════
-- REVIEWS
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner submits review"     ON public.reviews;
DROP POLICY IF EXISTS "Public reads approved"    ON public.reviews;
DROP POLICY IF EXISTS "Vet reads own reviews"    ON public.reviews;
DROP POLICY IF EXISTS "Admin manages reviews"    ON public.reviews;

-- Owner: sadece tamamlanmış randevu varsa yorum yapabilir (tekrar yorum yoksa)
CREATE POLICY "Owner submits review"
  ON public.reviews FOR INSERT
  WITH CHECK (
    auth.uid() = owner_id
    AND EXISTS (
      SELECT 1 FROM public.appointments a
      JOIN public.veterinarians v ON v.id = a.vet_id
      WHERE a.pet_id IN (SELECT id FROM public.pets WHERE owner_id = auth.uid())
        AND v.id = vet_id
        AND a.status = 'completed'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.reviews r
      WHERE r.owner_id = auth.uid() AND r.vet_id = vet_id
    )
  );

-- Herkes onaylı yorumları okur, owner kendi onaysız yorumunu da görür
CREATE POLICY "Public reads approved reviews"
  ON public.reviews FOR SELECT
  USING (is_approved = true OR auth.uid() = owner_id);

-- Vet sadece kendi hakkındaki yorumları okur
CREATE POLICY "Vet reads own reviews"
  ON public.reviews FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.veterinarians v WHERE v.id = vet_id AND v.user_id = auth.uid())
  );

-- ════════════════════════════════════════════════════════════
-- MESSAGES
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own messages"   ON public.messages;
DROP POLICY IF EXISTS "Users send messages"       ON public.messages;
DROP POLICY IF EXISTS "Users mark read"           ON public.messages;
DROP POLICY IF EXISTS "Users can view their own messages"    ON public.messages;
DROP POLICY IF EXISTS "Users can send messages"              ON public.messages;
DROP POLICY IF EXISTS "Users can mark messages as read"      ON public.messages;

-- Sadece randevu katılımcıları mesajlaşabilir
CREATE POLICY "Participants read messages"
  ON public.messages FOR SELECT
  USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );

CREATE POLICY "Sender inserts messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = appointment_id
        AND (
          a.owner_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.veterinarians v WHERE v.id = a.vet_id AND v.user_id = auth.uid())
        )
    )
  );

CREATE POLICY "Receiver marks read"
  ON public.messages FOR UPDATE
  USING (auth.uid() = receiver_id);

-- ════════════════════════════════════════════════════════════
-- SUBSCRIPTIONS
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vet reads own subscriptions"   ON public.subscriptions;
DROP POLICY IF EXISTS "Admin reads subscriptions"     ON public.subscriptions;

-- Vet sadece okur, düzenleyemez (sadece service role değiştirir)
CREATE POLICY "Vet reads own subscriptions"
  ON public.subscriptions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.veterinarians v WHERE v.id = vet_id AND v.user_id = auth.uid())
  );

-- ════════════════════════════════════════════════════════════
-- PAYMENTS
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vet reads own payments"    ON public.payments;
DROP POLICY IF EXISTS "Owner reads own payments"  ON public.payments;
DROP POLICY IF EXISTS "Admin reads all payments"  ON public.payments;

CREATE POLICY "Owner reads own payments"
  ON public.payments FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Vet reads own payments"
  ON public.payments FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.veterinarians v WHERE v.id = vet_id AND v.user_id = auth.uid())
  );

-- ════════════════════════════════════════════════════════════
-- REMINDERS
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner manages reminders"  ON public.reminders;

-- Sadece owner kendi hatırlatıcılarını görür (vet göremez)
CREATE POLICY "Owner reads own reminders"
  ON public.reminders FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Owner updates snooze"
  ON public.reminders FOR UPDATE
  USING (auth.uid() = owner_id);

-- ════════════════════════════════════════════════════════════
-- NOTIFICATIONS
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User manages own notifications"  ON public.notifications;

CREATE POLICY "User reads own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "User marks notification read"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════
-- SYMPTOM CHECKS
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.symptom_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner manages checks"         ON public.symptom_checks;
DROP POLICY IF EXISTS "Admin reads symptom checks"   ON public.symptom_checks;

-- Sadece owner kendi sorgularını görür (vet göremez)
CREATE POLICY "Owner manages own checks"
  ON public.symptom_checks FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- ════════════════════════════════════════════════════════════
-- DISPUTES
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vet manages own disputes"  ON public.disputes;
DROP POLICY IF EXISTS "Admin manages disputes"    ON public.disputes;

-- Vet kendi reviews için dispute açar ve okur
CREATE POLICY "Vet manages own disputes"
  ON public.disputes FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.veterinarians v WHERE v.id = vet_id AND v.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.veterinarians v WHERE v.id = vet_id AND v.user_id = auth.uid())
  );

-- Owner hiçbir şey göremez (sadece service role / admin)

-- ════════════════════════════════════════════════════════════
-- API_USAGE_LOGS — Sadece service role
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin reads api logs" ON public.api_usage_logs;
-- Policy yok = client erişemez, sadece service role

-- ════════════════════════════════════════════════════════════
-- SYSTEM_ERRORS — Sadece service role
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.system_errors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin reads system errors" ON public.system_errors;
-- Policy yok = client erişemez, sadece service role

-- ════════════════════════════════════════════════════════════
-- SONUÇ
-- ════════════════════════════════════════════════════════════
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
