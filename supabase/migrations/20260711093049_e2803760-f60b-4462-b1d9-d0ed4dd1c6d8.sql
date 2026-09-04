
-- IMPORTANT LINKS
CREATE TABLE public.important_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  url text NOT NULL,
  description text,
  category text,
  icon text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.important_links TO authenticated;
GRANT ALL ON public.important_links TO service_role;
ALTER TABLE public.important_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "links_admin_all" ON public.important_links FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "links_hr_read_active" ON public.important_links FOR SELECT TO authenticated
  USING (is_active = true);
CREATE TRIGGER trg_important_links_updated BEFORE UPDATE ON public.important_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER PUBLICATION supabase_realtime ADD TABLE public.important_links;

-- CLIENT REPORTS
CREATE TABLE public.client_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hr_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  client_name text NOT NULL,
  mobile text,
  broker text,
  opening_date date,
  status text NOT NULL DEFAULT 'pending',
  income numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_reports TO authenticated;
GRANT ALL ON public.client_reports TO service_role;
ALTER TABLE public.client_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_admin_all" ON public.client_reports FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "reports_hr_read_own" ON public.client_reports FOR SELECT TO authenticated
  USING (hr_id = auth.uid());
CREATE TRIGGER trg_client_reports_updated BEFORE UPDATE ON public.client_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_client_reports_hr ON public.client_reports(hr_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.client_reports;

-- REWARDS
CREATE TABLE public.rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  image_url text,
  milestone_amount numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rewards TO authenticated;
GRANT ALL ON public.rewards TO service_role;
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rewards_admin_all" ON public.rewards FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "rewards_hr_read_active" ON public.rewards FOR SELECT TO authenticated
  USING (is_active = true);
CREATE TRIGGER trg_rewards_updated BEFORE UPDATE ON public.rewards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER PUBLICATION supabase_realtime ADD TABLE public.rewards;

-- USER REWARDS (unlocks)
CREATE TABLE public.user_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_id uuid NOT NULL REFERENCES public.rewards(id) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  awarded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(user_id, reward_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_rewards TO authenticated;
GRANT ALL ON public.user_rewards TO service_role;
ALTER TABLE public.user_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ur_admin_all" ON public.user_rewards FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "ur_hr_read_own" ON public.user_rewards FOR SELECT TO authenticated
  USING (user_id = auth.uid());
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_rewards;

-- SUPPORT TICKETS
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  category text,
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'open',
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tk_admin_all" ON public.support_tickets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "tk_hr_read_own" ON public.support_tickets FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "tk_hr_insert_own" ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "tk_hr_update_own" ON public.support_tickets FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER trg_tickets_updated BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;

-- SUPPORT MESSAGES
CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role text NOT NULL DEFAULT 'hr',
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msg_admin_all" ON public.support_messages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "msg_owner_read" ON public.support_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid()));
CREATE POLICY "msg_owner_insert" ON public.support_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid()));
CREATE INDEX idx_support_messages_ticket ON public.support_messages(ticket_id, created_at);
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
