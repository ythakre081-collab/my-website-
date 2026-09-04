DROP TRIGGER IF EXISTS update_bank_details_updated_at ON public.bank_details;
DROP FUNCTION IF EXISTS public.update_bank_details_updated_at();

CREATE OR REPLACE FUNCTION public.update_bank_details_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_bank_details_updated_at() FROM PUBLIC;

CREATE TRIGGER update_bank_details_updated_at
BEFORE UPDATE ON public.bank_details
FOR EACH ROW EXECUTE FUNCTION public.update_bank_details_updated_at();