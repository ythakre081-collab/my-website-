
CREATE TABLE IF NOT EXISTS public.broker_legality (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_name text NOT NULL,
  launched_year text,
  is_legal boolean NOT NULL DEFAULT true,
  regulator text,
  registration_no text,
  description text,
  poster_path text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.broker_legality TO authenticated;
GRANT ALL ON public.broker_legality TO service_role;

ALTER TABLE public.broker_legality ENABLE ROW LEVEL SECURITY;

CREATE POLICY "broker_legality_read_all_auth" ON public.broker_legality
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "broker_legality_admin_insert" ON public.broker_legality
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "broker_legality_admin_update" ON public.broker_legality
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "broker_legality_admin_delete" ON public.broker_legality
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE TRIGGER trg_broker_legality_updated_at
  BEFORE UPDATE ON public.broker_legality
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "broker_legality_storage_read" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'broker-legality');
CREATE POLICY "broker_legality_storage_admin_write" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'broker-legality' AND public.is_admin(auth.uid()));
CREATE POLICY "broker_legality_storage_admin_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'broker-legality' AND public.is_admin(auth.uid()));
CREATE POLICY "broker_legality_storage_admin_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'broker-legality' AND public.is_admin(auth.uid()));

INSERT INTO public.broker_legality (broker_name, launched_year, is_legal, regulator, registration_no, description, sort_order) VALUES
  ('Angel One', '1987', true, 'SEBI', 'INZ000161534', 'Angel One (formerly Angel Broking) — SEBI registered stock broker, member of NSE, BSE, MCX & NCDEX. 100% legal in India.', 1),
  ('Upstox', '2009', true, 'SEBI', 'INZ000185137', 'Upstox (RKSV Securities) — SEBI registered discount broker, backed by Ratan Tata & Tiger Global. 100% legal in India.', 2),
  ('Groww', '2016', true, 'SEBI', 'INZ000193632', 'Groww (Nextbillion Technology) — SEBI registered stock broker & mutual fund distributor. 100% legal in India.', 3),
  ('Bigul', '1994', true, 'SEBI', 'INZ000170938', 'Bigul (Bonanza Portfolio group) — SEBI registered broker, active since 1994. 100% legal in India.', 4),
  ('m.Stock', '2022', true, 'SEBI', 'INZ000158136', 'm.Stock by Mirae Asset Capital Markets India — SEBI registered discount broker (parent Mirae Asset since 1997). 100% legal in India.', 5),
  ('Jainam', '2005', true, 'SEBI', 'INZ000047535', 'Jainam Broking Ltd — SEBI registered stock broker, member of NSE, BSE & MCX. 100% legal in India.', 6),
  ('Motilal Oswal', '1987', true, 'SEBI', 'INZ000158436', 'Motilal Oswal Financial Services — one of India''s oldest SEBI registered brokers, listed on NSE & BSE. 100% legal in India.', 7),
  ('HDFC Sky', '2023', true, 'SEBI', 'INZ000186937', 'HDFC Sky by HDFC Securities — SEBI registered, subsidiary of HDFC Bank. 100% legal in India.', 8),
  ('Choice Broking', '1993', true, 'SEBI', 'INZ000160131', 'Choice Equity Broking — SEBI registered, part of Choice International Ltd (listed on BSE). 100% legal in India.', 9)
ON CONFLICT DO NOTHING;
