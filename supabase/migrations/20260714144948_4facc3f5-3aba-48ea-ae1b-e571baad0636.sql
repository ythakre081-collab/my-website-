-- Align server-side admin check with client-side admin-email fallback so admins can manage leaderboard entries.
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = _user_id
        AND lower(u.email) IN ('ythakre081@gmail.com','admin@ytcommunity.com')
    );
$$;

-- Backfill admin role for any known admin email that is missing it.
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
FROM auth.users u
WHERE lower(u.email) IN ('ythakre081@gmail.com','admin@ytcommunity.com')
ON CONFLICT DO NOTHING;

-- Rebuild leaderboard_entries admin policy with the resilient check.
DROP POLICY IF EXISTS "Admins manage leaderboard" ON public.leaderboard_entries;
CREATE POLICY "Admins manage leaderboard"
  ON public.leaderboard_entries
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
