
CREATE POLICY "link_logos_read_authenticated" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'link-logos');
CREATE POLICY "link_logos_admin_write" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'link-logos' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "link_logos_admin_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'link-logos' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "link_logos_admin_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'link-logos' AND public.has_role(auth.uid(), 'admin'));
