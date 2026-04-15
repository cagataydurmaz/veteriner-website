-- notifications'da 3 policy var, "User manages notifications" (ALL) fazla
-- SELECT ve UPDATE ayrı ayrı tanımlı, ALL olanı kaldır
DROP POLICY IF EXISTS "User manages notifications"      ON public.notifications;
DROP POLICY IF EXISTS "User manages own notifications"  ON public.notifications;

-- Temiz hali: sadece SELECT ve UPDATE
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notifications' AND policyname='User reads own notifications') THEN
    CREATE POLICY "User reads own notifications" ON public.notifications FOR SELECT USING (auth.uid()=user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notifications' AND policyname='User marks notification read') THEN
    CREATE POLICY "User marks notification read" ON public.notifications FOR UPDATE USING (auth.uid()=user_id);
  END IF;
END $$;
