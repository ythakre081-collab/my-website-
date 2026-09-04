
CREATE TABLE public.broker_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  broker text NOT NULL,
  broker_link_id uuid REFERENCES public.important_links(id) ON DELETE SET NULL,
  hr_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  notes text,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size bigint,
  mime_type text,
  sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_broker_reports_hr ON public.broker_reports(hr_id);
CREATE INDEX idx_broker_reports_broker ON public.broker_reports(broker);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.broker_reports TO authenticated;
GRANT ALL ON public.broker_reports TO service_role;

ALTER TABLE public.broker_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "broker_reports_admin_all" ON public.broker_reports
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "broker_reports_hr_read_own" ON public.broker_reports
  FOR SELECT TO authenticated
  USING (hr_id = auth.uid());

CREATE TRIGGER trg_broker_reports_updated BEFORE UPDATE ON public.broker_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.broker_reports;

CREATE POLICY "broker_reports_storage_admin_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'broker-reports' AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'broker-reports' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "broker_reports_storage_hr_read_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'broker-reports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
