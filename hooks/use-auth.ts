import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type AppRole = "admin" | "hr";
export type HrStatus = "pending" | "approved" | "rejected" | "suspended";

export type HrProfile = {
  id: string;
  full_name: string;
  email: string;
  mobile: string | null;
  city: string | null;
  state: string | null;
  hr_code: string | null;
  status: HrStatus;
  avatar_url: string | null;
};

export type AuthState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  profile: HrProfile | null;
};

const ADMIN_EMAILS = new Set(["ythakre081@gmail.com", "admin@ytcommunity.com"]);

function isAdminEmail(email?: string | null) {
  return email ? ADMIN_EMAILS.has(email.trim().toLowerCase()) : false;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    loading: true,
    session: null,
    user: null,
    role: null,
    profile: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function load(session: Session | null) {
      if (!session?.user) {
        if (!cancelled)
          setState({ loading: false, session: null, user: null, role: null, profile: null });
        return;
      }
      let roles: { role: AppRole }[] | null = null;
      let profile: HrProfile | null = null;
      try {
        const [rRes, pRes] = await Promise.all([
          supabase.from("user_roles").select("role").eq("user_id", session.user.id),
          supabase.from("hr_profiles").select("*").eq("id", session.user.id).maybeSingle(),
        ]);
        roles = (rRes.data as { role: AppRole }[] | null) ?? null;
        profile = (pRes.data as HrProfile | null) ?? null;
      } catch (e) {
        console.error("useAuth load failed", e);
      }
      const role: AppRole | null = isAdminEmail(session.user.email) || roles?.some((r) => r.role === "admin")
        ? "admin"
        : roles?.some((r) => r.role === "hr") || profile?.status === "approved"
          ? "hr"
          : null;
      if (!cancelled)
        setState({
          loading: false,
          session,
          user: session.user,
          role,
          profile,
        });
    }

    supabase.auth.getSession().then(({ data }) => load(data.session));

    const { data: sub } = supabase.auth.onAuthStateChange((evt, session) => {
      // Only react to real identity changes. TOKEN_REFRESHED / INITIAL_SESSION
      // fire frequently (tab focus, hourly refresh, realtime) and re-running
      // load() there caused a brief null-role window that bounced admins to
      // /pending — looked like a random logout after clicking pin/edit.
      if (evt === "SIGNED_IN" || evt === "SIGNED_OUT" || evt === "USER_UPDATED") {
        load(session);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}