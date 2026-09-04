import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Users, UserCheck, UserX, Clock, FileText,
  Search, Download, Printer, FileSpreadsheet, Activity, Bell, Send, Upload, Trash2,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { PageShell } from "@/components/page-shell";
import { StatCard } from "@/components/stat-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_app/reports")({
  component: PerformanceDashboard,
});

type Lead = {
  id: string; status: string; bucket: string; assigned_to: string | null;
  created_at: string; updated_at: string;
};
type Attendance = {
  id: string; user_id: string; date: string;
  check_in: string | null; check_out: string | null;
  minutes_worked: number | null; is_late: boolean | null;
};
type Txn = { id: string; user_id: string; amount: number; type: string; created_at: string };
type Withdraw = { id: string; user_id: string; amount: number; status: string; created_at: string };
type Log = {
  id: string; actor_id: string | null; actor_email: string | null;
  action: string; entity_type: string; entity_id: string | null;
  metadata: Record<string, unknown> | null; created_at: string;
};
type HR = {
  id: string; full_name: string; email: string; hr_code: string | null;
  avatar_url: string | null; status: string;
};
type ImportantLink = { id: string; title: string; is_active: boolean };
type SharedReport = {
  id: string;
  broker: string;
  broker_link_id: string | null;
  hr_id: string;
  title: string;
  notes: string | null;
  file_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
};

const startOfToday = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
const daysAgo = (n: number) => { const d = startOfToday(); d.setDate(d.getDate() - n); return d; };
const fmtINR = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const fmtTime = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

function PerformanceDashboard() {
  const { role } = useAuth();
  const [hrs, setHrs] = useState<HR[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [withdraws, setWithdraws] = useState<Withdraw[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [importantLinks, setImportantLinks] = useState<ImportantLink[]>([]);
  const [sharedReports, setSharedReports] = useState<SharedReport[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [perfFilter, setPerfFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"score" | "calls" | "joinings" | "earnings">("score");
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportBrokerLinkId, setReportBrokerLinkId] = useState("custom");
  const [customReportName, setCustomReportName] = useState("");
  const [reportTitle, setReportTitle] = useState("");
  const [reportNotes, setReportNotes] = useState("");
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [selectedReportHrs, setSelectedReportHrs] = useState<Set<string>>(new Set());
  const [reportHrQuery, setReportHrQuery] = useState("");
  const [sendingReport, setSendingReport] = useState(false);
  const seenLogIds = useRef<Set<string>>(new Set());

  const today = startOfToday();
  const weekAgo = daysAgo(7);
  const monthAgo = daysAgo(30);
  const todayStr = today.toISOString().slice(0, 10);

  async function loadAll() {
    const monthISO = monthAgo.toISOString();
    const [h, l, a, t, w, lg, il, br] = await Promise.all([
      supabase.from("hr_profiles").select("id,full_name,email,hr_code,avatar_url,status"),
      supabase.from("leads").select("id,status,bucket,assigned_to,created_at,updated_at").gte("updated_at", monthISO),
      supabase.from("attendance").select("*").gte("date", monthAgo.toISOString().slice(0,10)),
      supabase.from("wallet_transactions").select("id,user_id,amount,type,created_at").gte("created_at", monthISO),
      supabase.from("withdraw_requests").select("id,user_id,amount,status,created_at"),
      supabase.from("activity_logs").select("*").gte("created_at", monthISO).order("created_at", { ascending: false }).limit(500),
      supabase.from("important_links").select("id,title,is_active").eq("is_active", true).order("sort_order"),
      supabase.from("broker_reports").select("id,broker,broker_link_id,hr_id,title,notes,file_path,file_name,file_size,mime_type,created_at").order("created_at", { ascending: false }),
    ]);
    setHrs((h.data ?? []) as HR[]);
    setLeads((l.data ?? []) as Lead[]);
    setAttendance((a.data ?? []) as Attendance[]);
    setTxns((t.data ?? []) as Txn[]);
    setWithdraws((w.data ?? []) as Withdraw[]);
    setImportantLinks((il.data ?? []) as ImportantLink[]);
    setSharedReports((br.data ?? []) as SharedReport[]);
    const initialLogs = (lg.data ?? []) as Log[];
    setLogs(initialLogs);
    seenLogIds.current = new Set(initialLogs.map((x) => x.id));
  }

  useEffect(() => {
    loadAll();
    const ch = supabase
      .channel("performance_dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "hr_profiles" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "wallet_transactions" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "withdraw_requests" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "broker_reports" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "important_links" }, loadAll)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_logs" }, (payload) => {
        const row = payload.new as Log;
        if (seenLogIds.current.has(row.id)) return;
        seenLogIds.current.add(row.id);
        setLogs((prev) => [row, ...prev].slice(0, 500));
        const notify: Record<string, string> = {
          hr_login: "🟢 HR logged in",
          hr_logout: "⚪ HR logged out",
          call_made: "📞 Call completed",
          call_connected: "📞 Call connected",
          whatsapp_sent: "💬 WhatsApp sent",
          account_open_submitted: "📄 Account opening submitted",
          account_approved: "✅ Account approved",
          joining_completed: "🎉 Joining completed",
          target_reached: "🏆 Daily target reached",
        };
        const label = notify[row.action];
        if (label) toast(label, { description: row.actor_email ?? undefined });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // ---------- Aggregations ----------
  const todayAttendance = attendance.filter((a) => a.date === todayStr);
  const todayLogs = logs.filter((l) => new Date(l.created_at) >= today);

  const activeHrIds = new Set(todayAttendance.filter((a) => a.check_in).map((a) => a.user_id));
  const approvedHrs = hrs.filter((h) => h.status === "approved");
  const pendingHrs = hrs.filter((h) => h.status === "pending");
  const activeImportantLinks = importantLinks.filter((link) => link.is_active);

  const reportHrList = useMemo(() => {
    const s = reportHrQuery.trim().toLowerCase();
    return approvedHrs.filter((h) => {
      if (!s) return true;
      return [h.full_name, h.email, h.hr_code].filter(Boolean).join(" ").toLowerCase().includes(s);
    });
  }, [approvedHrs, reportHrQuery]);

  const recentSharedReports = sharedReports.slice(0, 8);

  const summary = [
    { label: "Total HR", value: hrs.length, icon: Users },
    { label: "Active HR Today", value: activeHrIds.size, icon: UserCheck },
    { label: "Inactive HR Today", value: Math.max(0, approvedHrs.length - activeHrIds.size), icon: UserX },
    { label: "Pending Approval HR", value: pendingHrs.length, icon: Clock },
  ];

  // ---------- Per-HR aggregation ----------
  const rows = useMemo(() => {
    return hrs.map((h) => {
      const att = todayAttendance.find((a) => a.user_id === h.id);
      const hrLogsToday = todayLogs.filter((l) => l.actor_id === h.id);
      const hrLeads = leads.filter((l) => l.assigned_to === h.id);
      const hrLeadsToday = hrLeads.filter((l) => new Date(l.updated_at) >= today);
      const hrJoined = hrLeads.filter((l) => l.status === "joined");
      const jToday = hrJoined.filter((l) => new Date(l.updated_at) >= today).length;
      const jWeek = hrJoined.filter((l) => new Date(l.updated_at) >= weekAgo).length;
      const jMonth = hrJoined.length;
      const calls = hrLogsToday.filter((l) => l.action === "call_made").length;
      const connected = hrLogsToday.filter((l) => l.action === "call_connected").length;
      const wa = hrLogsToday.filter((l) => l.action === "whatsapp_sent").length;
      const interestedC = hrLeads.filter((l) => l.status === "interested").length;
      const followUpC = hrLeads.filter((l) => l.status === "follow_up").length;
      const rejectedC = hrLeads.filter((l) => l.status === "rejected" || l.status === "not_interested").length;
      const pendingC = hrLeads.filter((l) => l.status === "assigned" || l.status === "calling").length;
      const acctReq = hrLeads.filter((l) => l.bucket === "pending").length;
      const acctOpen = hrLeads.filter((l) => l.bucket === "open").length;
      const incentive = txns
        .filter((t) => t.user_id === h.id && ["incentive","bonus"].includes(t.type))
        .reduce((s, t) => s + Number(t.amount), 0);
      const salary = txns
        .filter((t) => t.user_id === h.id && t.type === "salary")
        .reduce((s, t) => s + Number(t.amount), 0);
      const online = activeHrIds.has(h.id) && !att?.check_out;
      // Performance score: weighted composite (0-100)
      const score = Math.min(100, Math.round(
        calls * 1.2 + connected * 2 + wa * 0.8 + interestedC * 3 + jToday * 15
      ));
      const workedH = att?.minutes_worked ? (att.minutes_worked / 60) : 0;
      const target = 8; // 8h shift
      return {
        hr: h, att, online,
        leadsAssignedToday: hrLeadsToday.length,
        leadsContacted: calls + wa,
        calls, connected, wa,
        interested: interestedC, followUp: followUpC, rejected: rejectedC, pending: pendingC,
        acctReq, acctOpen, jToday, jWeek, jMonth,
        incentive, salary,
        salaryProgress: Math.min(100, Math.round((workedH / target) * 100)),
        score,
      };
    });
  }, [hrs, leads, todayAttendance, todayLogs, txns, activeHrIds]);

  const filteredRows = useMemo(() => {
    let r = rows.filter((r) =>
      [r.hr.full_name, r.hr.email, r.hr.hr_code]
        .filter(Boolean).join(" ").toLowerCase().includes(query.toLowerCase()),
    );
    if (statusFilter === "online") r = r.filter((x) => x.online);
    if (statusFilter === "offline") r = r.filter((x) => !x.online);
    if (perfFilter === "high") r = r.filter((x) => x.score >= 70);
    else if (perfFilter === "mid") r = r.filter((x) => x.score >= 30 && x.score < 70);
    else if (perfFilter === "low") r = r.filter((x) => x.score < 30);
    r = [...r].sort((a, b) => {
      if (sortBy === "calls") return b.calls - a.calls;
      if (sortBy === "joinings") return b.jMonth - a.jMonth;
      if (sortBy === "earnings") return (b.incentive + b.salary) - (a.incentive + a.salary);
      return b.score - a.score;
    });
    return r;
  }, [rows, query, statusFilter, perfFilter, sortBy]);

  // ---------- Export ----------
  function exportExcel() {
    const data = filteredRows.map((r) => ({
      "HR Name": r.hr.full_name,
      "HR Code": r.hr.hr_code ?? "",
      "Email": r.hr.email,
      "Status": r.online ? "Online" : "Offline",
      "Check In": r.att?.check_in ? new Date(r.att.check_in).toLocaleString() : "",
      "Check Out": r.att?.check_out ? new Date(r.att.check_out).toLocaleString() : "",
      "Working Hours": r.att?.minutes_worked ? (r.att.minutes_worked / 60).toFixed(2) : "0",
      "Leads Assigned Today": r.leadsAssignedToday,
      "Leads Contacted": r.leadsContacted,
      "Calls Today": r.calls,
      "Connected": r.connected,
      "WhatsApp": r.wa,
      "Interested": r.interested,
      "Follow-Up": r.followUp,
      "Rejected": r.rejected,
      "Pending": r.pending,
      "Acct Requests": r.acctReq,
      "Accounts Opened": r.acctOpen,
      "Joinings Today": r.jToday,
      "Weekly Joinings": r.jWeek,
      "Monthly Joinings": r.jMonth,
      "Incentive": r.incentive,
      "Salary": r.salary,
      "Salary Progress %": r.salaryProgress,
      "Score %": r.score,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "HR Performance");
    XLSX.writeFile(wb, `hr-performance-${todayStr}.xlsx`);
  }

  function printReport() { window.print(); }

  function resetReportForm() {
    setReportBrokerLinkId("custom");
    setCustomReportName("");
    setReportTitle("");
    setReportNotes("");
    setReportFile(null);
    setSelectedReportHrs(new Set());
    setReportHrQuery("");
  }

  function toggleReportHr(id: string) {
    setSelectedReportHrs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectVisibleReportHrs() {
    setSelectedReportHrs(new Set(reportHrList.map((h) => h.id)));
  }

  async function sendReportToHrs() {
    const selectedLink = activeImportantLinks.find((link) => link.id === reportBrokerLinkId);
    const reportName = selectedLink?.title ?? customReportName.trim();
    if (!reportName) return toast.error("Report name required");
    if (!reportTitle.trim()) return toast.error("Report title required");
    if (!reportFile) return toast.error("Please choose a report file");
    if (selectedReportHrs.size === 0) return toast.error("Select at least one HR");

    const uploadedPaths: string[] = [];
    setSendingReport(true);
    try {
      const safeName = reportFile.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-90) || "report";
      const baseName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
      const rowsToInsert: Array<{ path: string; hrId: string }> = [];

      for (const hrId of selectedReportHrs) {
        const path = `${hrId}/${baseName}`;
        const { error: uploadError } = await supabase.storage
          .from("broker-reports")
          .upload(path, reportFile, { contentType: reportFile.type || "application/octet-stream", upsert: false });
        if (uploadError) throw uploadError;
        uploadedPaths.push(path);
        rowsToInsert.push({ path, hrId });
      }

      const { data: auth } = await supabase.auth.getUser();
      const payload = rowsToInsert.map((row) => ({
        broker: reportName,
        broker_link_id: selectedLink?.id ?? null,
        hr_id: row.hrId,
        title: reportTitle.trim(),
        notes: reportNotes.trim() || null,
        file_path: row.path,
        file_name: reportFile.name,
        file_size: reportFile.size,
        mime_type: reportFile.type || null,
        sent_by: auth.user?.id ?? null,
      }));

      const { error } = await supabase.from("broker_reports").insert(payload);
      if (error) throw error;

      toast.success(`Report sent to ${rowsToInsert.length} HR${rowsToInsert.length === 1 ? "" : "s"}`);
      setReportDialogOpen(false);
      resetReportForm();
      loadAll();
    } catch (error) {
      if (uploadedPaths.length > 0) await supabase.storage.from("broker-reports").remove(uploadedPaths);
      toast.error(error instanceof Error ? error.message : "Report send failed");
    } finally {
      setSendingReport(false);
    }
  }

  async function downloadSharedReport(report: SharedReport) {
    const { data, error } = await supabase.storage
      .from("broker-reports")
      .createSignedUrl(report.file_path, 60, { download: report.file_name });
    if (error || !data) return toast.error(error?.message ?? "Download failed");
    window.open(data.signedUrl, "_blank");
  }

  async function deleteSharedReport(report: SharedReport) {
    if (!confirm("Delete this shared report?")) return;
    await supabase.storage.from("broker-reports").remove([report.file_path]);
    const { error } = await supabase.from("broker_reports").delete().eq("id", report.id);
    if (error) return toast.error(error.message);
    toast.success("Report deleted");
    loadAll();
  }

  if (role !== "admin") {
    return (
      <PageShell title="Performance" description="Admin access only">
        <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
          You don't have access to the performance dashboard.
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Admin Command Center"
      description="Live HR performance, real-time analytics & every action tracked in one place"
      actions={
        <div className="flex flex-wrap gap-2 sm:justify-end print:hidden">
          <Dialog open={reportDialogOpen} onOpenChange={(open) => { setReportDialogOpen(open); if (!open) resetReportForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="relative overflow-hidden border-0 bg-[linear-gradient(135deg,#8b5cf6,#6366f1_50%,#ec4899)] text-white shadow-[0_8px_24px_-8px_rgba(139,92,246,0.7)] hover:shadow-[0_10px_28px_-6px_rgba(236,72,153,0.65)] hover:brightness-110 transition-all">
                <Send className="mr-1 h-4 w-4" />Share Report
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-strong max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Upload & Share Report</DialogTitle></DialogHeader>
              <div className="grid gap-4">
                <div>
                  <Label>Report for</Label>
                  <Select value={reportBrokerLinkId} onValueChange={setReportBrokerLinkId}>
                    <SelectTrigger className="glass"><SelectValue placeholder="Select report type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">Custom report</SelectItem>
                      {activeImportantLinks.map((link) => <SelectItem key={link.id} value={link.id}>{link.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {reportBrokerLinkId === "custom" && (
                  <div>
                    <Label>Report name</Label>
                    <Input value={customReportName} onChange={(e) => setCustomReportName(e.target.value)} placeholder="e.g. Angel One Report" className="glass" />
                  </div>
                )}
                <div>
                  <Label>Title</Label>
                  <Input value={reportTitle} onChange={(e) => setReportTitle(e.target.value)} placeholder="e.g. Angel One weekly report" className="glass" />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea value={reportNotes} onChange={(e) => setReportNotes(e.target.value)} placeholder="Optional message for selected HR" rows={2} className="glass" />
                </div>
                <div>
                  <Label>Upload file</Label>
                  <div className="glass rounded-xl p-3 flex items-center gap-3">
                    <input id="admin-report-file" type="file" className="hidden" onChange={(e) => setReportFile(e.target.files?.[0] ?? null)} />
                    <label htmlFor="admin-report-file" className="cursor-pointer inline-flex items-center gap-2 rounded-lg bg-white/10 hover:bg-white/20 px-3 py-2 text-sm">
                      <Upload className="h-4 w-4" />Choose file
                    </label>
                    <span className="min-w-0 truncate text-sm text-muted-foreground">
                      {reportFile ? `${reportFile.name} (${(reportFile.size / 1024).toFixed(1)} KB)` : "No file chosen"}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Label>Send to HR ({selectedReportHrs.size} selected)</Label>
                    <Button type="button" size="sm" variant="ghost" onClick={selectVisibleReportHrs}>Select visible</Button>
                  </div>
                  <Input value={reportHrQuery} onChange={(e) => setReportHrQuery(e.target.value)} placeholder="Search HR by name, email, code…" className="mb-2 glass" />
                  <div className="glass max-h-64 overflow-y-auto rounded-xl divide-y divide-white/5">
                    {reportHrList.length === 0 && <div className="p-4 text-center text-sm text-muted-foreground">No HR found</div>}
                    {reportHrList.map((hr) => (
                      <label key={hr.id} className="flex cursor-pointer items-center gap-3 p-3 hover:bg-white/5">
                        <Checkbox checked={selectedReportHrs.has(hr.id)} onCheckedChange={() => toggleReportHr(hr.id)} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{hr.full_name} {hr.hr_code && <span className="text-xs text-muted-foreground">({hr.hr_code})</span>}</div>
                          <div className="truncate text-xs text-muted-foreground">{hr.email}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={sendReportToHrs} disabled={sendingReport} className="gradient-primary text-white">
                  {sendingReport ? "Sending…" : `Send to ${selectedReportHrs.size} HR${selectedReportHrs.size === 1 ? "" : "s"}`}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button size="sm" onClick={exportExcel} className="border border-emerald-400/30 bg-[linear-gradient(135deg,rgba(16,185,129,0.18),rgba(5,150,105,0.08))] text-emerald-100 hover:bg-[linear-gradient(135deg,rgba(16,185,129,0.28),rgba(5,150,105,0.14))] shadow-[0_6px_18px_-8px_rgba(16,185,129,0.55)] transition-all">
            <FileSpreadsheet className="mr-1 h-4 w-4" />Excel
          </Button>
          <Button size="sm" onClick={printReport} className="border border-sky-400/30 bg-[linear-gradient(135deg,rgba(56,189,248,0.18),rgba(59,130,246,0.08))] text-sky-100 hover:bg-[linear-gradient(135deg,rgba(56,189,248,0.28),rgba(59,130,246,0.14))] shadow-[0_6px_18px_-8px_rgba(56,189,248,0.55)] transition-all">
            <Printer className="mr-1 h-4 w-4" />Print
          </Button>
          <Button size="sm" onClick={printReport} className="border border-amber-400/30 bg-[linear-gradient(135deg,rgba(251,191,36,0.2),rgba(249,115,22,0.1))] text-amber-100 hover:bg-[linear-gradient(135deg,rgba(251,191,36,0.3),rgba(249,115,22,0.16))] shadow-[0_6px_18px_-8px_rgba(251,146,60,0.55)] transition-all">
            <Download className="mr-1 h-4 w-4" />PDF
          </Button>
        </div>
      }
    >
      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {summary.map((s, i) => (
          <StatCard key={s.label} label={s.label} value={String(s.value)} icon={s.icon} index={i} />
        ))}
      </div>

      <div className="mt-8 print:hidden">
        <div className="mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Shared HR reports</h2>
          <Badge className="ml-auto bg-primary/20 text-primary border border-primary/30">{sharedReports.length}</Badge>
        </div>
        <div className="glass rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Report</th>
                  <th className="px-3 py-3 text-left">HR</th>
                  <th className="px-3 py-3 text-left">Sent</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentSharedReports.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No reports shared yet</td></tr>
                )}
                {recentSharedReports.map((report) => {
                  const hr = hrs.find((h) => h.id === report.hr_id);
                  return (
                    <tr key={report.id} className="hover:bg-white/[0.03]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 font-medium"><FileText className="h-4 w-4 text-primary" />{report.title}</div>
                        <div className="text-xs text-muted-foreground">{report.broker} · {report.file_name}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium">{hr?.full_name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{hr?.hr_code ?? ""}</div>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">{new Date(report.created_at).toLocaleString()}</td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <Button size="icon" variant="ghost" onClick={() => downloadSharedReport(report)}><Download className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteSharedReport(report)}><Trash2 className="h-4 w-4 text-rose-400" /></Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-8 mb-3 flex flex-wrap items-center gap-2 print:hidden">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search HR by name, email, code…" className="pl-9 glass border-border" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] glass border-border"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
          </SelectContent>
        </Select>
        <Select value={perfFilter} onValueChange={setPerfFilter}>
          <SelectTrigger className="w-[160px] glass border-border"><SelectValue placeholder="Performance" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All performance</SelectItem>
            <SelectItem value="high">High (≥70)</SelectItem>
            <SelectItem value="mid">Mid (30-69)</SelectItem>
            <SelectItem value="low">Low (&lt;30)</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
          <SelectTrigger className="w-[160px] glass border-border"><SelectValue placeholder="Sort by" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="score">Sort · Score</SelectItem>
            <SelectItem value="calls">Sort · Calls</SelectItem>
            <SelectItem value="joinings">Sort · Joinings</SelectItem>
            <SelectItem value="earnings">Sort · Earnings</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* HR Performance Table */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">HR</th>
                <th className="text-left px-3 py-3">Status</th>
                <th className="text-left px-3 py-3">Login</th>
                <th className="text-left px-3 py-3">Logout</th>
                <th className="text-right px-3 py-3">Hrs</th>
                <th className="text-right px-3 py-3">Leads</th>
                <th className="text-right px-3 py-3">Contacted</th>
                <th className="text-right px-3 py-3">Calls</th>
                <th className="text-right px-3 py-3">Conn</th>
                <th className="text-right px-3 py-3">WA</th>
                <th className="text-right px-3 py-3">Int</th>
                <th className="text-right px-3 py-3">F/U</th>
                <th className="text-right px-3 py-3">Rej</th>
                <th className="text-right px-3 py-3">Pend</th>
                <th className="text-right px-3 py-3">Req</th>
                <th className="text-right px-3 py-3">Open</th>
                <th className="text-right px-3 py-3">J·Today</th>
                <th className="text-right px-3 py-3">J·Week</th>
                <th className="text-right px-3 py-3">J·Month</th>
                <th className="text-right px-3 py-3">Incentive</th>
                <th className="text-right px-3 py-3">Salary</th>
                <th className="text-right px-3 py-3">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredRows.length === 0 && (
                <tr><td colSpan={22} className="px-4 py-10 text-center text-muted-foreground">No HR match your filters</td></tr>
              )}
              {filteredRows.map((r, i) => (
                <motion.tr
                  key={r.hr.id}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.01 }}
                  className="hover:bg-white/[0.03]"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        {r.hr.avatar_url && <AvatarImage src={r.hr.avatar_url} />}
                        <AvatarFallback className="gradient-primary text-white text-[10px]">
                          {r.hr.full_name.split(" ").map((n) => n[0]).slice(0,2).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="truncate font-medium">{r.hr.full_name}</div>
                        <div className="truncate text-[11px] text-muted-foreground">{r.hr.hr_code}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <Badge variant="outline" className={r.online ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300" : "border-slate-500/30 bg-slate-500/10 text-slate-300"}>
                      <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${r.online ? "bg-emerald-400 animate-pulse" : "bg-slate-400"}`} />
                      {r.online ? "Online" : "Offline"}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">{fmtTime(r.att?.check_in ?? null)}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{fmtTime(r.att?.check_out ?? null)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{r.att?.minutes_worked ? (r.att.minutes_worked/60).toFixed(1) : "—"}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{r.leadsAssignedToday}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{r.leadsContacted}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{r.calls}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{r.connected}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{r.wa}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-emerald-300">{r.interested}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-amber-300">{r.followUp}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-rose-300">{r.rejected}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{r.pending}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{r.acctReq}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{r.acctOpen}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{r.jToday}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{r.jWeek}</td>
                  <td className="px-3 py-3 text-right tabular-nums font-semibold">{r.jMonth}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmtINR(r.incentive)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmtINR(r.salary)}</td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex items-center justify-end gap-2 min-w-[110px]">
                      <div className="h-1.5 w-16 rounded-full bg-white/10 overflow-hidden">
                        <div className={`h-full ${r.score >= 70 ? "bg-emerald-400" : r.score >= 30 ? "bg-amber-400" : "bg-rose-400"}`} style={{ width: `${r.score}%` }} />
                      </div>
                      <span className="tabular-nums font-semibold">{r.score}%</span>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live activity feed */}
      <div className="mt-8 print:hidden">
        <div className="mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Live activity</h2>
          <Bell className="ml-auto h-4 w-4 text-primary animate-pulse" />
        </div>
        <div className="glass rounded-2xl divide-y divide-border max-h-[420px] overflow-y-auto">
          {logs.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">No activity yet</div>
          )}
          {logs.slice(0, 60).map((l) => (
            <div key={l.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <div className="grid h-8 w-8 place-items-center rounded-full gradient-primary text-white text-[10px]">
                {(l.actor_email ?? "?").slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate">
                  <span className="font-medium">{l.actor_email ?? "system"}</span>
                  <span className="mx-1 text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{l.action.replaceAll("_", " ")}</span>
                  {l.entity_type && <span className="ml-1 text-muted-foreground">({l.entity_type})</span>}
                </div>
              </div>
              <div className="text-[11px] text-muted-foreground whitespace-nowrap">
                {new Date(l.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
