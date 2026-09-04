CREATE TABLE IF NOT EXISTS public.daily_income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  note TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, entry_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_income TO authenticated;
GRANT ALL ON public.daily_income TO service_role;

ALTER TABLE public.daily_income ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own daily income" ON public.daily_income
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Admins manage daily income" ON public.daily_income
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_daily_income_user_date ON public.daily_income(user_id, entry_date DESC);

CREATE OR REPLACE FUNCTION public.touch_daily_income() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_touch_daily_income ON public.daily_income;
CREATE TRIGGER trg_touch_daily_income BEFORE UPDATE ON public.daily_income
  FOR EACH ROW EXECUTE FUNCTION public.touch_daily_income();