
-- 1. app_settings: restrict SELECT to authenticated
DROP POLICY IF EXISTS "Anyone read settings" ON public.app_settings;
CREATE POLICY "Authenticated read settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.app_settings FROM anon;

-- 2. leaderboard_entries: restrict SELECT to authenticated
DROP POLICY IF EXISTS "Anyone can read leaderboard" ON public.leaderboard_entries;
CREATE POLICY "Authenticated read leaderboard" ON public.leaderboard_entries FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.leaderboard_entries FROM anon;

-- 3. user_roles: remove admin-role visibility to all HR users, expose via SECURITY DEFINER function
DROP POLICY IF EXISTS "HR can view admin role for live chat" ON public.user_roles;

CREATE OR REPLACE FUNCTION public.get_admin_user_ids()
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin'::public.app_role;
$$;
REVOKE ALL ON FUNCTION public.get_admin_user_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_user_ids() TO authenticated;

-- 4. Storage: paid-leads bucket ownership enforcement
-- Path pattern for user uploads: screenshots/{userId}/...
-- Path pattern for admin QR: qr/...
DROP POLICY IF EXISTS "paid-leads read" ON storage.objects;
DROP POLICY IF EXISTS "paid-leads insert" ON storage.objects;

-- SELECT: owner of screenshot folder, or admin, or any authenticated user reading qr/*
CREATE POLICY "paid-leads read own or admin"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'paid-leads'
  AND (
    public.is_admin(auth.uid())
    OR ((storage.foldername(name))[1] = 'qr')
    OR ((storage.foldername(name))[1] = 'screenshots' AND (storage.foldername(name))[2] = auth.uid()::text)
  )
);

-- INSERT: user can only upload to their own screenshots folder; admin can upload anywhere (incl. qr/)
CREATE POLICY "paid-leads insert own or admin"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'paid-leads'
  AND (
    public.is_admin(auth.uid())
    OR ((storage.foldername(name))[1] = 'screenshots' AND (storage.foldername(name))[2] = auth.uid()::text)
  )
);
