import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ScrollText, Search } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/activity-logs")({
  component: ActivityLogsPage,
});

type LogRow = {
  id: string;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
};

function ActivityLogsPage() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    let alive = true;
    async function load() {
      const { data } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (alive) {
        setRows((data ?? []) as LogRow[]);
        setLoading(false);
      }
    }
    load();
    const ch = supabase
      .channel("activity_logs_feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_logs" }, (p) => {
        setRows((prev) => [p.new as LogRow, ...prev].slice(0, 500));
      })
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, []);

  const filtered = rows.filter((r) => {
    if (!q) return true;
    const hay = `${r.actor_email} ${r.action} ${r.entity_type} ${r.entity_id}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  return (
    <PageShell title="Activity Logs" description="Every admin & user action, in real-time">
      <div className="mb-4 flex items-center gap-2 glass rounded-xl px-3 py-2 max-w-md">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by user, action, entity…"
          className="border-0 bg-transparent focus-visible:ring-0"
        />
      </div>
      <div className="glass rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 px-4 py-3 text-[11px] uppercase tracking-widest text-muted-foreground border-b border-white/5">
          <div>Who</div><div>Action</div><div>Entity</div><div>When</div>
        </div>
        {loading && <div className="px-4 py-6 text-sm text-muted-foreground">Loading…</div>}
        {!loading && filtered.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            <ScrollText className="mx-auto mb-2 h-6 w-6 opacity-40" />
            No activity yet.
          </div>
        )}
        <ul>
          {filtered.map((r) => (
            <li
              key={r.id}
              className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 text-sm"
            >
              <div className="truncate">{r.actor_email ?? "—"}</div>
              <div>
                <Badge variant="outline" className="border-white/10 bg-white/5">{r.action}</Badge>
              </div>
              <div className="truncate text-muted-foreground">
                {r.entity_type}{r.entity_id ? ` · ${r.entity_id.slice(0, 8)}` : ""}
              </div>
              <div className="text-xs text-muted-foreground whitespace-nowrap">
                {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </PageShell>
  );
}