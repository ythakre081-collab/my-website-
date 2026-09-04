
-- Seed super admin account so login works out of the box
DO $$
DECLARE
  v_uid uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = 'ythakre081@gmail.com';

  IF v_uid IS NULL THEN
    v_uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_uid, 'authenticated', 'authenticated',
      'ythakre081@gmail.com',
      crypt('Yogesh@626487', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Yogesh Thakre"}'::jsonb,
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_uid,
      jsonb_build_object('sub', v_uid::text, 'email', 'ythakre081@gmail.com', 'email_verified', true),
      'email', v_uid::text, now(), now(), now());
  ELSE
    UPDATE auth.users
       SET encrypted_password = crypt('Yogesh@626487', gen_salt('bf')),
           email_confirmed_at = COALESCE(email_confirmed_at, now()),
           updated_at = now()
     WHERE id = v_uid;
  END IF;

  -- Ensure profile exists & approved
  INSERT INTO public.hr_profiles (id, full_name, email, status, hr_code)
  VALUES (v_uid, 'Yogesh Thakre', 'ythakre081@gmail.com', 'approved'::public.hr_status,
          'SCS-' || upper(substr(replace(v_uid::text,'-',''),1,6)))
  ON CONFLICT (id) DO UPDATE SET status = 'approved'::public.hr_status;

  -- Ensure admin + hr roles
  INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'admin'::public.app_role)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'hr'::public.app_role)
    ON CONFLICT DO NOTHING;
END $$;
