
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_is_admin boolean := lower(NEW.email) IN ('admin@ytcommunity.com', 'ythakre081@gmail.com');
BEGIN
  INSERT INTO public.hr_profiles (id, full_name, email, mobile, city, state, referral_code, status, hr_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NEW.email,
    NEW.raw_user_meta_data->>'mobile',
    NEW.raw_user_meta_data->>'city',
    NEW.raw_user_meta_data->>'state',
    NEW.raw_user_meta_data->>'referral_code',
    CASE WHEN v_is_admin THEN 'approved'::public.hr_status ELSE 'pending'::public.hr_status END,
    'SCS-' || upper(substr(replace(NEW.id::text,'-',''),1,6))
  );

  IF v_is_admin THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'hr') ON CONFLICT DO NOTHING;

  RETURN NEW;
END; $function$;

-- Promote existing user if already registered
DO $$
DECLARE v_uid uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = 'ythakre081@gmail.com' LIMIT 1;
  IF v_uid IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'admin') ON CONFLICT DO NOTHING;
    UPDATE public.hr_profiles SET status = 'approved' WHERE id = v_uid;
  END IF;
END $$;
