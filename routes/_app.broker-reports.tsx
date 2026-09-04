import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Send, Trash2, Download, Search, FileText, Upload, Users as UsersIcon } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/broker-reports")({ component: BrokerReportsAdminPage });

type Link = { id: string; title: string; is_active: boolean };
type Hr = { id: string; full_name: string; hr_code: string | null; email: string };
type Report = {
  id: string;
  broker: string;
  broker_link_id: string | null;
  hr_id: string;
  title: string;
  notes: string | null;
  file_path: string;
  file_name: string;
  file_size: number | null;
  created_at: string;
};

function BrokerReportsAdminPage() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [links, setLinks] = useState<Link[]>([]);
  const [hrs, setHrs] = useState<Hr[]>([]);
  const [rows, setRows] = useState<Report[]>([]);
  const [q, setQ] = useState("");
  const [brokerFilter, setBrokerFilter] = useState("all");

  // send form
  const [open, setOpen] = useState(false);
  const [brokerLinkId, setBrokerLinkId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [selectedHrs, setSelectedHrs] = useState<Set<string>>(new Set());
  const [hrQuery, setHrQuery] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    const load = async () => {
      const [l, h, r] = await Promise.all([
        supabase.from("important_links").select("id,title,is_active").eq("is_active", true).order("sort_order"),
        supabase.from("hr_profiles").select("id,full_name,hr_code,email").eq("status", "approved").order("full_name"),
        supabase.from("broker_reports").select("*").order("created_at", { ascending: false }),
      ]);
      setLinks((l.data ?? []) as Link[]);
      setHrs((h.data ?? []) as Hr[]);
      setRows((r.data ?? []) as Report[]);
    };
    load();
    const ch = supabase.channel("broker_reports_admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "broker_reports" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isAdmin]);

  const filteredHrs = useMemo(() => {
    const s = hrQuery.trim().toLowerCase();
    if (!s) return hrs;
    return hrs.filter(h => `${h.full_name} ${h.hr_code ?? ""} ${h.email}`.toLowerCase().includes(s));
  }, [hrs, hrQuery]);

  const brokers = useMemo(() => Array.from(new Set(rows.map(r => r.broker))).sort(), [rows]);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter(r => {
      if (brokerFilter !== "all" && r.broker !== brokerFilter) return false;
      if (!s) return true;
      const hr = hrs.find(x => x.id === r.hr_id);
      return `${r.broker} ${r.title} ${r.notes ?? ""} ${hr?.full_name ?? ""} ${hr?.hr_code ?? ""}`.toLowerCase().includes(s);
    });
  }, [rows, q, brokerFilter, hrs]);

  function toggleHr(id: string) {
    setSelectedHrs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelectedHrs(new Set(filteredHrs.map(h => h.id)));
  }

  function reset() {
    setBrokerLinkId(""); setTitle(""); setNotes(""); setFile(null);
    setSelectedHrs(new Set()); setHrQuery("");
  }

  async function send() {
    if (!brokerLinkId) return toast.error("Select a broker (Demat link)");
    const link = links.find(l => l.id === brokerLinkId);
    if (!link) return toast.error("Invalid broker");
    if (!title.trim()) return toast.error("Title required");
    if (!file) return toast.error("Attach a report file");
    if (selectedHrs.size === 0) return toast.error("Select at least one HR");

    setSending(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const baseName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const rowsToInsert: Array<{ path: string; hr: string }> = [];

      for (const hrId of selectedHrs) {
        const path = `${hrId}/${baseName}`;
        const { error: upErr } = await supabase.storage
          .from("broker-reports")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        rowsToInsert.push({ path, hr: hrId });
      }

      const { data: auth } = await supabase.auth.getUser();
      const payload = rowsToInsert.map(r => ({
        broker: link.title,
        broker_link_id: link.id,
        hr_id: r.hr,
        title: title.trim(),
        notes: notes.trim() || null,
        file_path: r.path,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || null,
        sent_by: auth.user?.id ?? null,
      }));
      const { error } = await supabase.from("broker_reports").insert(payload);
      if (error) throw error;

      toast.success(`Sent to ${rowsToInsert.length} HR${rowsToInsert.length > 1 ? "s" : ""}`);
      setOpen(false); reset();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to send";
      toast.error(msg);
    } finally {
      setSending(false);
    }
  }

  async function remove(r: Report) {
    if (!confirm("Delete this report? This cannot be undone.")) return;
    await supabase.storage.from("broker-reports").remove([r.file_path]);
    const { error } = await supabase.from("broker_reports").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
  }

  async function download(r: Report) {
    const { data, error } = await supabase.storage
      .from("broker-reports")
      .createSignedUrl(r.file_path, 60, { download: r.file_name });
    if (error || !data) return toast.error(error?.message ?? "Download failed");
    window.open(data.signedUrl, "_blank");
  }

  if (!isAdmin) {
    return (
      <PageShell title="Broker Reports" description="Admin only">
        <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
          You don't have access to this page.
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Send Broker Reports"
      description="Send a broker-specific report file (e.g. Angel One) to selected HRs"
      actions={
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-white"><Send className="mr-2 h-4 w-4" />Send New Report</Button>
          </DialogTrigger>
          <DialogContent className="glass-strong max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Send Broker Report</DialogTitle></DialogHeader>
            <div className="grid gap-4">
              <div>
                <Label>Broker (Demat Link)</Label>
                <Select value={brokerLinkId} onValueChange={setBrokerLinkId}>
                  <SelectTrigger><SelectValue placeholder="Choose broker…" /></SelectTrigger>
                  <SelectContent>
                    {links.map(l => <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Angel One - November Report" />
              </div>
              <div>
                <Label>Notes (optional)</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any message for the HR" rows={2} />
              </div>
              <div>
                <Label>Report File</Label>
                <div className="glass rounded-xl p-3 flex items-center gap-3">
                  <input
                    id="report-file"
                    type="file"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  <label htmlFor="report-file" className="cursor-pointer inline-flex items-center gap-2 rounded-lg bg-white/10 hover:bg-white/20 px-3 py-2 text-sm">
                    <Upload className="h-4 w-4" /> Choose file
                  </label>
                  <span className="text-sm text-muted-foreground truncate">
                    {file ? `${file.name} (${(file.size / 1024).toFixed(1)} KB)` : "No file chosen"}
                  </span>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="flex items-center gap-2"><UsersIcon className="h-4 w-4" />Send To HR ({selectedHrs.size} selected)</Label>
                  <Button type="button" size="sm" variant="ghost" onClick={selectAllVisible}>Select all visible</Button>
                </div>
                <Input value={hrQuery} onChange={(e) => setHrQuery(e.target.value)} placeholder="Search HR…" className="mb-2 glass" />
                <div className="glass rounded-xl max-h-64 overflow-y-auto divide-y divide-white/5">
                  {filteredHrs.length === 0 && <div className="p-4 text-sm text-muted-foreground text-center">No HR found</div>}
                  {filteredHrs.map(h => (
                    <label key={h.id} className="flex items-center gap-3 p-3 hover:bg-white/5 cursor-pointer">
                      <Checkbox checked={selectedHrs.has(h.id)} onCheckedChange={() => toggleHr(h.id)} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{h.full_name} {h.hr_code && <span className="text-xs text-muted-foreground">({h.hr_code})</span>}</div>
                        <div className="text-xs text-muted-foreground truncate">{h.email}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={send} disabled={sending} className="gradient-primary text-white">
                {sending ? "Sending…" : `Send to ${selectedHrs.size} HR${selectedHrs.size === 1 ? "" : "s"}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search broker, HR, title…" className="glass pl-9" />
        </div>
        <Select value={brokerFilter} onValueChange={setBrokerFilter}>
          <SelectTrigger className="w-52 glass"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All brokers</SelectItem>
            {brokers.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="glass rounded-2xl overflow-hidden border border-white/5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3">Broker</th>
                <th className="text-left p-3">Title / File</th>
                <th className="text-left p-3">HR</th>
                <th className="text-left p-3">Sent</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const hr = hrs.find(h => h.id === r.hr_id);
                return (
                  <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="border-t border-white/5">
                    <td className="p-3"><Badge className="bg-primary/20 text-primary border border-primary/30">{r.broker}</Badge></td>
                    <td className="p-3">
                      <div className="font-medium flex items-center gap-2"><FileText className="h-4 w-4 text-primary" />{r.title}</div>
                      <div className="text-xs text-muted-foreground">{r.file_name}</div>
                    </td>
                    <td className="p-3">{hr?.full_name ?? "—"} <span className="text-xs text-muted-foreground">{hr?.hr_code ? `(${hr.hr_code})` : ""}</span></td>
                    <td className="p-3 text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="p-3 text-right">
                      <Button size="icon" variant="ghost" onClick={() => download(r)}><Download className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(r)}><Trash2 className="h-4 w-4 text-rose-400" /></Button>
                    </td>
                  </motion.tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-muted-foreground">No reports sent yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </PageShell>
  );
}