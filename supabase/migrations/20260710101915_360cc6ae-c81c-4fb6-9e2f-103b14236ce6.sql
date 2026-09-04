
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'hr');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- HR profile status
CREATE TYPE public.hr_status AS ENUM ('pending', 'approved', 'rejected', 'suspended');

CREATE TABLE public.hr_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL UNIQUE,
  mobile text,
  city text,
  state text,
  referral_code text,
  hr_code text UNIQUE,
  status public.hr_status NOT NULL DEFAULT 'pending',
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.hr_profiles TO authenticated;
GRANT ALL ON public.hr_profiles TO service_role;
ALTER TABLE public.hr_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR can view own profile" ON public.hr_profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "HR can update own profile" ON public.hr_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins view all HR" ON public.hr_profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update all HR" ON public.hr_profiles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_hr_profiles_updated
BEFORE UPDATE ON public.hr_profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create HR profile + assign HR role on signup; admin auto-granted for known seed email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_is_admin boolean := lower(NEW.email) IN ('admin@ytcommunity.com');
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
    'YTC-' || upper(substr(replace(NEW.id::text,'-',''),1,6))
  );

  IF v_is_admin THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'hr') ON CONFLICT DO NOTHING;

  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Leads
CREATE TYPE public.lead_status AS ENUM ('new','assigned','calling','interested','not_interested','follow_up','joined','rejected');
CREATE TYPE public.lead_bucket AS ENUM ('today','tomorrow','previous','open','pending');

CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  mobile text NOT NULL UNIQUE,
  bucket public.lead_bucket NOT NULL DEFAULT 'today',
  status public.lead_status NOT NULL DEFAULT 'new',
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at timestamptz,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_leads_assigned_to ON public.leads(assigned_to);
CREATE INDEX idx_leads_bucket ON public.leads(bucket);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR sees own leads" ON public.leads
  FOR SELECT TO authenticated USING (assigned_to = auth.uid());
CREATE POLICY "HR updates own leads" ON public.leads
  FOR UPDATE TO authenticated USING (assigned_to = auth.uid());
CREATE POLICY "Admins full access" ON public.leads
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_leads_updated
BEFORE UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.hr_profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
