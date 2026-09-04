
CREATE TABLE public.income_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  today numeric NOT NULL DEFAULT 0,
  week numeric NOT NULL DEFAULT 0,
  month numeric NOT NULL DEFAULT 0,
  lifetime numeric NOT NULL DEFAULT 0,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.income_overrides TO authenticated;
GRANT ALL ON public.income_overrides TO service_role;

ALTER TABLE public.income_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all income overrides"
  ON public.income_overrides
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "HR can view own override"
  ON public.income_overrides
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER income_overrides_set_updated_at
  BEFORE UPDATE ON public.income_overrides
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.income_overrides;
ALTER TABLE public.income_overrides REPLICA IDENTITY FULL;
