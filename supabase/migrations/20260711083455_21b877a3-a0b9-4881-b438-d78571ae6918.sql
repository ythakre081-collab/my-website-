
CREATE TABLE public.work_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  video_url text NOT NULL,
  thumbnail_url text,
  category text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_videos TO authenticated;
GRANT ALL ON public.work_videos TO service_role;

ALTER TABLE public.work_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can view active work videos"
  ON public.work_videos FOR SELECT
  TO authenticated
  USING (is_active OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert work videos"
  ON public.work_videos FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update work videos"
  ON public.work_videos FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete work videos"
  ON public.work_videos FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER work_videos_set_updated_at
  BEFORE UPDATE ON public.work_videos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.work_videos;
ALTER TABLE public.work_videos REPLICA IDENTITY FULL;
