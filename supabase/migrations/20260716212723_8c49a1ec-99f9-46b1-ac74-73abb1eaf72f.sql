CREATE TABLE public.bank_details (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  account_holder_name TEXT,
  bank_name TEXT,
  account_number TEXT,
  ifsc_code TEXT,
  upi_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_details TO authenticated;
GRANT ALL ON public.bank_details TO service_role;

ALTER TABLE public.bank_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own bank details"
ON public.bank_details FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all bank details"
ON public.bank_details FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.update_bank_details_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_bank_details_updated_at
BEFORE UPDATE ON public.bank_details
FOR EACH ROW EXECUTE FUNCTION public.update_bank_details_updated_at();