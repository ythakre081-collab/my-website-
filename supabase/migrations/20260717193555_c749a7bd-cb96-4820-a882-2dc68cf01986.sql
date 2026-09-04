CREATE TABLE public.special_offer_posters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,
  month_label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.special_offer_posters TO authenticated;
GRANT ALL ON public.special_offer_posters TO service_role;

ALTER TABLE public.special_offer_posters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone approved can view active posters"
  ON public.special_offer_posters FOR SELECT
  TO authenticated
  USING (is_active = true OR public.is_admin(auth.uid()));

CREATE POLICY "Admins manage posters"
  ON public.special_offer_posters FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER special_offer_posters_updated_at
  BEFORE UPDATE ON public.special_offer_posters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();