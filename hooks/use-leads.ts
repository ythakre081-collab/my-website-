import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Lead } from "@/components/leads-list";

export function useLeads(bucket: "today" | "tomorrow" | "previous" | "open" | "pending") {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from("leads")
        .select("id,name,mobile,status,assigned_to,created_at")
        .eq("bucket", bucket)
        .order("created_at", { ascending: false });
      if (!cancelled) {
        setLeads((data ?? []) as Lead[]);
        setLoading(false);
      }
    }
    load();
    const ch = supabase
      .channel(`leads_${bucket}_${Math.random()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, load)
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [bucket]);

  return { leads, loading };
}