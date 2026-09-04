
-- Branding settings singleton (id = 1)
CREATE TABLE public.brand_settings (
  id INT PRIMARY KEY DEFAULT 1,
  logo_url TEXT,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT brand_settings_singleton CHECK (id = 1)
);

GRANT SELECT ON public.brand_settings TO authenticated;
GRANT INSERT, UPDATE ON public.brand_settings TO authenticated;
GRANT ALL ON public.brand_settings TO service_role;

ALTER TABLE public.brand_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone signed in can read brand settings"
  ON public.brand_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only admins can insert brand settings"
  ON public.brand_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update brand settings"
  ON public.brand_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.brand_settings (id, logo_url) VALUES (1, NULL)
  ON CONFLICT (id) DO NOTHING;

-- Storage policies for branding bucket
CREATE POLICY "Anyone signed in can read branding files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'branding');

CREATE POLICY "Admins can upload branding"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update branding"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete branding"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin'));
