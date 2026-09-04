CREATE POLICY "Auth users read marketing status"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'marketing-status');

CREATE POLICY "Admins upload marketing status"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'marketing-status' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update marketing status"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'marketing-status' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete marketing status"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'marketing-status' AND public.has_role(auth.uid(), 'admin'));