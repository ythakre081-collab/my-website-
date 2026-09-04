DROP POLICY IF EXISTS "send as self" ON public.direct_messages;
CREATE POLICY "send as self" ON public.direct_messages
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND (
    broadcast_scope IS NULL
    OR (broadcast_scope = 'all_hrs' AND public.has_role(auth.uid(), 'admin'::app_role))
  )
);