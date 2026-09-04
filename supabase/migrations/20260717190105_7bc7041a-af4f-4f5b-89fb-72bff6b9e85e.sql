
-- Add paid leads settings columns
ALTER TABLE public.app_settings 
  ADD COLUMN IF NOT EXISTS paid_leads_upi text,
  ADD COLUMN IF NOT EXISTS paid_leads_qr_url text,
  ADD COLUMN IF NOT EXISTS paid_leads_price numeric DEFAULT 10,
  ADD COLUMN IF NOT EXISTS paid_leads_note text;

-- Paid lead requests table
CREATE TABLE IF NOT EXISTS public.paid_lead_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hr_id uuid NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  amount numeric NOT NULL,
  utr text,
  screenshot_url text,
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected','fulfilled')),
  admin_note text,
  verified_by uuid,
  verified_at timestamptz,
  fulfilled_at timestamptz,
  leads_uploaded integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.paid_lead_requests TO authenticated;
GRANT ALL ON public.paid_lead_requests TO service_role;

ALTER TABLE public.paid_lead_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR reads own paid requests" ON public.paid_lead_requests
  FOR SELECT TO authenticated USING (hr_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "HR creates own paid requests" ON public.paid_lead_requests
  FOR INSERT TO authenticated WITH CHECK (hr_id = auth.uid());

CREATE POLICY "Admin updates requests" ON public.paid_lead_requests
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admin deletes requests" ON public.paid_lead_requests
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE TRIGGER trg_paid_lead_requests_touch
  BEFORE UPDATE ON public.paid_lead_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Add a 'paid' bucket type to leads (via extending check if any) — reuse bucket text, use 'paid'
