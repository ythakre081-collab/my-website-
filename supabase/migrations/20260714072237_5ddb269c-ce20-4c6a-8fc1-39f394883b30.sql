
ALTER TABLE public.support_messages
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

CREATE POLICY "Authed read support-attachments" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'support-attachments');
CREATE POLICY "Users upload own support-attachment" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'support-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own support-attachment" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'support-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Admins manage support-attachments" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'support-attachments' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'support-attachments' AND public.has_role(auth.uid(), 'admin'));
