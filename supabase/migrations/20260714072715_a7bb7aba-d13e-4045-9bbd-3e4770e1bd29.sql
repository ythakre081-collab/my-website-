
CREATE TABLE public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  broadcast_scope text,
  body text NOT NULL,
  read_at timestamptz,
  edited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (recipient_id IS NOT NULL OR broadcast_scope IS NOT NULL)
);

CREATE INDEX idx_dm_pair ON public.direct_messages(sender_id, recipient_id, created_at DESC);
CREATE INDEX idx_dm_recipient ON public.direct_messages(recipient_id, created_at DESC);
CREATE INDEX idx_dm_broadcast ON public.direct_messages(broadcast_scope, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.direct_messages TO authenticated;
GRANT ALL ON public.direct_messages TO service_role;

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read own or broadcast or admin" ON public.direct_messages FOR SELECT
TO authenticated USING (
  auth.uid() = sender_id
  OR auth.uid() = recipient_id
  OR broadcast_scope = 'all_hrs'
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "send as self" ON public.direct_messages FOR INSERT
TO authenticated WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "edit own or admin" ON public.direct_messages FOR UPDATE
TO authenticated USING (auth.uid() = sender_id OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() = sender_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "delete own or admin" ON public.direct_messages FOR DELETE
TO authenticated USING (auth.uid() = sender_id OR public.has_role(auth.uid(), 'admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
