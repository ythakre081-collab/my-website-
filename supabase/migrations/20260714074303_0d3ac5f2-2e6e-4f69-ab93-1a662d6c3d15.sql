CREATE TABLE public.marketing_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  media_url text NOT NULL,
  media_type text NOT NULL DEFAULT 'image',
  title text,
  caption text,
  link_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_status TO authenticated;
GRANT ALL ON public.marketing_status TO service_role;

ALTER TABLE public.marketing_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view active status"
  ON public.marketing_status FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert status"
  ON public.marketing_status FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update status"
  ON public.marketing_status FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete status"
  ON public.marketing_status FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_marketing_status_updated_at
  BEFORE UPDATE ON public.marketing_status
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();