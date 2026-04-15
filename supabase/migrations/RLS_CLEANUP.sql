-- ============================================================
-- VetBul — RLS Cleanup: Bug fix + duplicate temizliği
-- ============================================================

-- ── Duplicate policy'leri temizle ───────────────────────────
DROP POLICY IF EXISTS "Owner manages pets"         ON public.pets;
DROP POLICY IF EXISTS "Owner writes reviews"       ON public.reviews;
DROP POLICY IF EXISTS "Vet reads own subs"         ON public.subscriptions;
DROP POLICY IF EXISTS "Users read own"             ON public.users;
DROP POLICY IF EXISTS "Users update own"           ON public.users;
DROP POLICY IF EXISTS "Vet read own"               ON public.veterinarians;
DROP POLICY IF EXISTS "Vet update own"             ON public.veterinarians;
DROP POLICY IF EXISTS "Vet insert own"             ON public.veterinarians;
DROP POLICY IF EXISTS "Public read verified vets"  ON public.veterinarians;

-- ── Tehlikeli policy'leri sil ────────────────────────────────
-- Herkesin tüm yorumları görmesine izin veriyordu
DROP POLICY IF EXISTS "Public read reviews"        ON public.reviews;

-- Olmayan 'published' kolonunu referans alıyordu
DROP POLICY IF EXISTS "Public read published posts" ON public.blog_posts;

-- ── Vaccines bug fix: a.pet_id = a.pet_id → vaccines.pet_id ─
DROP POLICY IF EXISTS "Vet reads patient vaccines" ON public.vaccines;
CREATE POLICY "Vet reads patient vaccines"
  ON public.vaccines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      JOIN public.veterinarians v ON v.id = a.vet_id
      WHERE a.pet_id = vaccines.pet_id
        AND v.user_id = auth.uid()
        AND a.status != 'cancelled'
    )
  );

-- ── Weight logs bug fix: a.pet_id = a.pet_id → weight_logs.pet_id ─
DROP POLICY IF EXISTS "Vet reads patient weight" ON public.weight_logs;
CREATE POLICY "Vet reads patient weight"
  ON public.weight_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      JOIN public.veterinarians v ON v.id = a.vet_id
      WHERE a.pet_id = weight_logs.pet_id
        AND v.user_id = auth.uid()
        AND a.status != 'cancelled'
    )
  );

-- ── Sonuç: kalan policy sayısı ──────────────────────────────
SELECT tablename, count(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;
