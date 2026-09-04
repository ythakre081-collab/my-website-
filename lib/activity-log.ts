import { supabase } from "@/integrations/supabase/client";

export async function logActivity(params: {
  action: string;
  entity_type: string;
  entity_id?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) return;
    await supabase.from("activity_logs").insert({
      actor_id: user.id,
      actor_email: user.email ?? null,
      action: params.action,
      entity_type: params.entity_type,
      entity_id: params.entity_id ?? null,
      metadata: (params.metadata ?? {}) as never,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
  } catch {
    // logging must never break the caller
  }
}