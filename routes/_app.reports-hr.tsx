import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Download, Search, FileText, Inbox } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/reports-hr")({ component: HrReportsPage });

type BrokerReport = {
  id: string;
  broker: string;
  title: string;
  notes: string | null;
  file_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
};

function fmtSize(n: number | null) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function HrReportsPage() {
  const [rows, setRows] = useState<BrokerReport[]>([]);
  const [q, setQ] = useState("");
  const [brokerFilter, setBrokerFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("broker_reports")
        .select("id,broker,title,notes,file_path,file_name,file_size,mime_type,created_at")
        .order("created_at", { ascending: false });
      setRows((data ?? []) as BrokerReport[]);
      setLoading(false);
    };
    load();
    const ch = supabase.channel("broker_reports_hr")
      .on("postgres_changes", { event: "*", schema: "public", table: "broker_reports" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const brokers = useMemo(() => Array.from(new Set(rows.map(r => r.broker))).sort(), [rows]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter(r => {
      if (brokerFilter !== "all" && r.broker !== brokerFilter) return false;
      if (!s) return true;
      return `${r.broker} ${r.title} ${r.notes ?? ""}`.toLowerCase().includes(s);
    });
  }, [rows, q, brokerFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, BrokerReport[]>();
    for (const r of filtered) {
      if (!map.has(r.broker)) map.set(r.broker, []);
      map.get(r.broker)!.push(r);
    }
    return Array.from(map.entries());
  }, [filtered]);

  async function download(r: BrokerReport) {
    const { data, error } = await supabase.storage
      .from("broker-reports")
      .createSignedUrl(r.file_path, 60, { download: r.file_name });
    if (error || !data) return toast.error(error?.message ?? "Download failed");
    window.open(data.signedUrl, "_blank");
  }

  return (
    <PageShell title="Reports" description="Reports sent to you by admin, grouped by broker">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search broker, title, notes…" className="glass pl-9" />
        </div>
        <Select value={brokerFilter} onValueChange={setBrokerFilter}>
          <SelectTrigger className="w-52 glass"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All brokers</SelectItem>
            {brokers.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : grouped.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center">
          <Inbox className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <div className="text-sm text-muted-foreground">No reports yet. Admin will send broker reports to you here.</div>
        </div>
      ) : (
        <div className="grid gap-6">
          {grouped.map(([broker, items]) => (
            <div key={broker} className="glass rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg gradient-primary grid place-items-center text-white text-xs font-bold">
                    {broker.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold">{broker} Reports</div>
                    <div className="text-xs text-muted-foreground">{items.length} report{items.length > 1 ? "s" : ""}</div>
                  </div>
                </div>
                <Badge className="bg-primary/20 text-primary border border-primary/30">{items.length}</Badge>
              </div>
              <div className="grid gap-2">
                {items.map((r, i) => (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i, 10) * 0.03 }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition"
                  >
                    <div className="h-10 w-10 rounded-lg bg-primary/15 grid place-items-center text-primary shrink-0">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{r.title}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {r.file_name} {r.file_size ? `· ${fmtSize(r.file_size)}` : ""} · {new Date(r.created_at).toLocaleString()}
                      </div>
                      {r.notes && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.notes}</div>}
                    </div>
                    <Button size="sm" onClick={() => download(r)} className="gradient-primary text-white shrink-0">
                      <Download className="mr-1 h-4 w-4" />Download
                    </Button>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}