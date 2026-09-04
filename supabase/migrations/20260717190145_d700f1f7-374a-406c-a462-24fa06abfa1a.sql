
CREATE POLICY "paid-leads read" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'paid-leads');

CREATE POLICY "paid-leads insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'paid-leads');

CREATE POLICY "paid-leads admin update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'paid-leads' AND public.is_admin(auth.uid()));

CREATE POLICY "paid-leads admin delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'paid-leads' AND public.is_admin(auth.uid()));
