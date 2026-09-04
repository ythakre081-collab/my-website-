
-- ============ HR status: suspend ============
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid=e.enumtypid WHERE t.typname='hr_status' AND e.enumlabel='suspended') THEN
    ALTER TYPE public.hr_status ADD VALUE 'suspended';
  END IF;
END $$;

-- ============ Activity Logs ============
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text, action text NOT NULL, entity_type text NOT NULL, entity_id text,
  metadata jsonb DEFAULT '{}'::jsonb, ip_address text, user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins view all logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Authenticated insert own logs" ON public.activity_logs;
CREATE POLICY "Admins view all logs" ON public.activity_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Authenticated insert own logs" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());
CREATE INDEX IF NOT EXISTS activity_logs_created_at_idx ON public.activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS activity_logs_entity_idx ON public.activity_logs (entity_type, entity_id);

-- ============ Announcements ============
DO $$ BEGIN CREATE TYPE public.announcement_priority AS ENUM ('low','normal','high','urgent'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL, body text NOT NULL,
  priority public.announcement_priority NOT NULL DEFAULT 'normal',
  pinned boolean NOT NULL DEFAULT false,
  scheduled_for timestamptz, published_at timestamptz DEFAULT now(),
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All authed view published" ON public.announcements;
DROP POLICY IF EXISTS "Admins manage announcements" ON public.announcements;
CREATE POLICY "All authed view published" ON public.announcements FOR SELECT TO authenticated
  USING ((published_at IS NOT NULL AND published_at <= now()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage announcements" ON public.announcements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
DROP TRIGGER IF EXISTS announcements_updated ON public.announcements;
CREATE TRIGGER announcements_updated BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ Wallet Transactions ============
DO $$ BEGIN CREATE TYPE public.wallet_txn_type AS ENUM ('salary','incentive','bonus','withdraw','adjustment'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  type public.wallet_txn_type NOT NULL, note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "HR view own txns" ON public.wallet_transactions;
DROP POLICY IF EXISTS "Admins full txn access" ON public.wallet_transactions;
CREATE POLICY "HR view own txns" ON public.wallet_transactions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins full txn access" ON public.wallet_transactions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX IF NOT EXISTS wallet_txns_user_idx ON public.wallet_transactions(user_id, created_at DESC);

-- ============ Withdraw Requests ============
DO $$ BEGIN CREATE TYPE public.withdraw_status AS ENUM ('pending','approved','rejected','paid'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS public.withdraw_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  status public.withdraw_status NOT NULL DEFAULT 'pending',
  method text, details jsonb DEFAULT '{}'::jsonb, note text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.withdraw_requests TO authenticated;
GRANT ALL ON public.withdraw_requests TO service_role;
ALTER TABLE public.withdraw_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "HR view own withdraws" ON public.withdraw_requests;
DROP POLICY IF EXISTS "HR create own withdraws" ON public.withdraw_requests;
DROP POLICY IF EXISTS "Admins manage withdraws" ON public.withdraw_requests;
CREATE POLICY "HR view own withdraws" ON public.withdraw_requests FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "HR create own withdraws" ON public.withdraw_requests FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins manage withdraws" ON public.withdraw_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
DROP TRIGGER IF EXISTS withdraws_updated ON public.withdraw_requests;
CREATE TRIGGER withdraws_updated BEFORE UPDATE ON public.withdraw_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ Attendance ============
CREATE TABLE IF NOT EXISTS public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT current_date,
  check_in timestamptz, check_out timestamptz,
  minutes_worked integer, is_late boolean DEFAULT false, note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "HR manage own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Admins view all attendance" ON public.attendance;
DROP POLICY IF EXISTS "Admins update all attendance" ON public.attendance;
CREATE POLICY "HR manage own attendance" ON public.attendance FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins view all attendance" ON public.attendance FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update all attendance" ON public.attendance FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
DROP TRIGGER IF EXISTS attendance_updated ON public.attendance;
CREATE TRIGGER attendance_updated BEFORE UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ App Settings ============
CREATE TABLE IF NOT EXISTS public.app_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  site_name text DEFAULT 'YT Community Hub',
  tagline text DEFAULT 'Creator CRM • HR Management • Earn Daily',
  logo_url text, banner_url text, theme text DEFAULT 'dark',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO authenticated, anon;
GRANT INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone read settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins write settings" ON public.app_settings;
CREATE POLICY "Anyone read settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Admins write settings" ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.app_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

-- ============ Storage RLS ============
DROP POLICY IF EXISTS "Authed read announcements" ON storage.objects;
DROP POLICY IF EXISTS "Admins write announcements" ON storage.objects;
DROP POLICY IF EXISTS "Admins update announcements" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete announcements" ON storage.objects;
CREATE POLICY "Authed read announcements" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'announcements');
CREATE POLICY "Admins write announcements" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'announcements' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update announcements" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'announcements' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete announcements" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'announcements' AND public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Authed read avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own avatar" ON storage.objects;
CREATE POLICY "Authed read avatars" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'avatars');
CREATE POLICY "Users upload own avatar" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users update own avatar" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own avatar" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Authed read branding" ON storage.objects;
DROP POLICY IF EXISTS "Admins manage branding" ON storage.objects;
CREATE POLICY "Authed read branding" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'branding');
CREATE POLICY "Admins manage branding" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'branding' AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (bucket_id = 'branding' AND public.has_role(auth.uid(),'admin'));

-- ============ Realtime (guarded) ============
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.wallet_transactions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.withdraw_requests; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
