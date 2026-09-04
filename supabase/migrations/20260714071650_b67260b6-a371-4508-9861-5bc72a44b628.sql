
-- Leaderboard entries (admin-managed)
CREATE TABLE public.leaderboard_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  badge TEXT,
  avatar_url TEXT,
  subtitle TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.leaderboard_entries TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leaderboard_entries TO authenticated;
GRANT ALL ON public.leaderboard_entries TO service_role;
ALTER TABLE public.leaderboard_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read leaderboard" ON public.leaderboard_entries FOR SELECT USING (true);
CREATE POLICY "Admins manage leaderboard" ON public.leaderboard_entries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER leaderboard_entries_set_updated BEFORE UPDATE ON public.leaderboard_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Legal documents (admin-managed)
CREATE TABLE public.legal_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  category TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.legal_documents TO authenticated;
GRANT ALL ON public.legal_documents TO service_role;
ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read legal docs" ON public.legal_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage legal docs" ON public.legal_documents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER legal_documents_set_updated BEFORE UPDATE ON public.legal_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Rewards page banner in app_settings
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS rewards_banner_url TEXT;

-- Storage policies for legal-documents bucket (created via tool below)
CREATE POLICY "Authenticated read legal-documents storage" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'legal-documents');
CREATE POLICY "Admins manage legal-documents storage" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'legal-documents' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'legal-documents' AND public.has_role(auth.uid(), 'admin'));

-- Storage policies for leaderboard avatars (reuse existing `avatars` bucket via new folder)
-- (avatars bucket policies likely already permit reads to authenticated; add admin write for leaderboard prefix if needed)
