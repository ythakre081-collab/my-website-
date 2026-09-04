import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Coins, Search, IndianRupee, Loader2, Trash2, Plus, CalendarDays, Wallet as WalletIcon, Check, X, Copy, BellRing } from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/page-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { logActivity } from "@/lib/activity-log";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/admin-income")({
  component: AdminIncomePage,
});

type HR = { id: string; full_name: string; email: string; hr_code: string | null; avatar_url: string | null };
type Daily = { id: string; user_id: string; entry_date: string; amount: number };
type Withdraw = { id: string; user_id: string; amount: number; status: string; method: string | null; details: any; created_at: string };

type Draft = { amount: string; entry_date: string; note: string };
const todayStr = () => new Date().toISOString().slice(0, 10);
const emptyDraft = (): Draft => ({ amount: "", entry_date: todayStr(), note: "" });

function startOfMonth() { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; }
function daysAgo(n: number) { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n); return d; }

function computeTotals(rows: Daily[]) {
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  const w0 = daysAgo(6); // last 7 days including today
  const m0 = startOfMonth();
  let today = 0, week = 0, month = 0, lifetime = 0;
  for (const r of rows) {
    const d = new Date(r.entry_date + "T00:00:00");
    const a = Number(r.amount) || 0;
    lifetime += a;
    if (d.getTime() === t0.getTime()) today += a;
    if (d.getTime() >= w0.getTime()) week += a;
    if (d.getTime() >= m0.getTime()) month += a;
  }
  return { today, week, month, lifetime };
}

function AdminIncomePage() {
  const { role } = useAuth();
  const [hrs, setHrs] = useState<HR[]>([]);
  const [entries, setEntries] = useState<Record<string, Daily[]>>({});
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [withdraws, setWithdraws] = useState<Withdraw[]>([]);
  const [acting, setActing] = useState<string | null>(null);

  async function load() {
    const [{ data: h }, { data: o }, { data: w }] = await Promise.all([
      supabase.from("hr_profiles").select("id,full_name,email,hr_code,avatar_url").order("full_name"),
      supabase.from("daily_income").select("id,user_id,entry_date,amount").order("entry_date", { ascending: false }),
      supabase.from("withdraw_requests").select("id,user_id,amount,status,method,details,created_at").order("created_at", { ascending: false }).limit(100),
    ]);
    setHrs((h ?? []) as HR[]);
    const map: Record<string, Daily[]> = {};
    for (const r of (o ?? []) as Daily[]) (map[r.user_id] ??= []).push(r);
    setEntries(map);
    setWithdraws((w ?? []) as Withdraw[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("admin_daily_income")
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_income" }, load)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "withdraw_requests" }, (payload: any) => {
        const amt = Number(payload?.new?.amount ?? 0);
        toast.success(`New withdrawal request: ₹${amt.toLocaleString("en-IN")}`, { icon: "💸" });
        load();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "withdraw_requests" }, load)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "withdraw_requests" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  async function actOn(w: Withdraw, status: "approved" | "rejected" | "paid") {
    setActing(w.id);
    const { error } = await supabase
      .from("withdraw_requests")
      .update({ status: status as any, reviewed_at: new Date().toISOString() })
      .eq("id", w.id);
    setActing(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`Withdrawal ${status}`);
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  }

  const filtered = useMemo(
    () => hrs.filter((h) =>
      [h.full_name, h.email, h.hr_code].filter(Boolean).join(" ").toLowerCase().includes(q.toLowerCase()),
    ),
    [hrs, q],
  );

  const hrById = useMemo(() => {
    const m: Record<string, HR> = {};
    for (const h of hrs) m[h.id] = h;
    return m;
  }, [hrs]);

  const pendingWithdraws = withdraws.filter((w) => w.status === "pending");

  function getDraft(id: string): Draft {
    return drafts[id] ?? emptyDraft();
  }
  function updateDraft(id: string, k: keyof Draft, v: string) {
    setDrafts((d) => ({ ...d, [id]: { ...getDraft(id), [k]: v } }));
  }

  async function save(hr: HR) {
    const d = getDraft(hr.id);
    const amt = Number(d.amount);
    if (!Number.isFinite(amt) || amt === 0) { toast.error("Enter an amount"); return; }
    if (!d.entry_date) { toast.error("Pick a date"); return; }
    const row = {
      user_id: hr.id,
      entry_date: d.entry_date,
      amount: amt,
      note: d.note || null,
      created_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    };
    setSaving(hr.id);
    const { error } = await supabase
      .from("daily_income")
      .upsert(row, { onConflict: "user_id,entry_date" });
    setSaving(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`₹${amt.toLocaleString("en-IN")} saved for ${hr.full_name} on ${d.entry_date}`);
    setDrafts((all) => ({ ...all, [hr.id]: emptyDraft() }));
    logActivity({
      action: "daily_income_saved",
      entity_type: "daily_income",
      entity_id: hr.id,
      metadata: row,
    });
  }

  async function removeEntry(id: string) {
    if (!confirm("Delete this entry?")) return;
    const { error } = await supabase.from("daily_income").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
  }

  if (role !== "admin") {
    return (
      <PageShell title="Manual Income">
        <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
          You don't have access to this page.
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title="Manual Income Control" description="Add a daily income entry for any HR — Today, 7-Day, Monthly & Lifetime totals auto-calculate everywhere.">
      <div className="mb-4 flex items-center gap-2 glass rounded-xl px-3 py-2 max-w-md">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search HR by name, email, code…"
          className="border-0 bg-transparent focus-visible:ring-0" />
      </div>

      {loading ? (
        <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <>
        <div className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-amber-400/30 to-rose-500/30 ring-1 ring-amber-400/40">
              <BellRing className="h-4 w-4 text-amber-200" />
            </div>
            <div>
              <div className="text-sm font-semibold">Withdrawal Requests</div>
              <div className="text-[11px] text-muted-foreground">
                {pendingWithdraws.length} pending · {withdraws.length} total
              </div>
            </div>
            {pendingWithdraws.length > 0 && (
              <Badge className="ml-2 bg-amber-500/20 text-amber-200 border-amber-400/30">{pendingWithdraws.length} NEW</Badge>
            )}
          </div>
          {withdraws.length === 0 ? (
            <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">No withdrawal requests yet.</div>
          ) : (
            <div className="grid gap-2">
              {withdraws.slice(0, 20).map((w) => {
                const hr = hrById[w.user_id];
                const upi = (w.details && (w.details as any).upi) || "—";
                return (
                  <motion.div
                    key={w.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "glass rounded-2xl p-4 border border-white/5",
                      w.status === "pending" && "ring-1 ring-amber-400/30 shadow-[0_0_18px_rgba(251,191,36,0.15)]",
                    )}
                  >
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,240px)_1fr_auto] lg:items-center">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-10 w-10 shrink-0">
                          <AvatarFallback className="gradient-primary text-white text-xs">
                            {(hr?.full_name ?? "U").split(" ").map((n) => n[0]).slice(0, 2).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{hr?.full_name ?? "Unknown HR"}</div>
                          <div className="truncate text-[11px] text-muted-foreground">{hr?.hr_code ?? "—"} · {new Date(w.created_at).toLocaleString("en-IN")}</div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <div className="flex items-center gap-1 font-bold text-emerald-300">
                          <IndianRupee className="h-4 w-4" />{Number(w.amount).toLocaleString("en-IN")}
                        </div>
                        <div className="text-[11px] text-muted-foreground">{w.method || "UPI"}</div>
                        <button
                          onClick={() => copy(String(upi))}
                          className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-[11px] hover:bg-white/10"
                          title="Copy UPI"
                        >
                          <span className="font-mono">{upi}</span>
                          <Copy className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 justify-end">
                        {w.status === "pending" ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => actOn(w, "approved")}
                              disabled={acting === w.id}
                              className="h-8 bg-gradient-to-r from-emerald-500 to-green-600 text-white border-0"
                            >
                              <Check className="mr-1 h-3.5 w-3.5" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => actOn(w, "rejected")}
                              disabled={acting === w.id}
                              className="h-8 border-rose-400/30 text-rose-300 hover:bg-rose-500/10"
                            >
                              <X className="mr-1 h-3.5 w-3.5" /> Reject
                            </Button>
                          </>
                        ) : (
                          <Badge
                            variant="outline"
                            className={cn(
                              "border-white/10",
                              w.status === "approved" || w.status === "paid" ? "bg-emerald-500/15 text-emerald-300" :
                              w.status === "rejected" ? "bg-rose-500/15 text-rose-300" :
                              "bg-amber-500/15 text-amber-300",
                            )}
                          >
                            {w.status}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mb-3 flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl gradient-primary">
            <WalletIcon className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold">Manual Income Entry</div>
            <div className="text-[11px] text-muted-foreground">Add daily income for any HR</div>
          </div>
        </div>
        <div className="grid gap-3">
          {filtered.length === 0 && (
            <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">No HR found</div>
          )}
          {filtered.map((h, i) => {
            const rows = entries[h.id] ?? [];
            const totals = computeTotals(rows);
            const d = getDraft(h.id);
            const isOpen = !!expanded[h.id];
            return (
              <motion.div
                key={h.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className="glass rounded-2xl p-4 sm:p-5 border border-white/5"
              >
                <div className="grid gap-4 lg:grid-cols-[minmax(0,220px)_1fr_auto] lg:items-end">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-11 w-11 shrink-0">
                      <AvatarFallback className="gradient-primary text-white text-xs">
                        {h.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{h.full_name}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{h.email} · {h.hr_code ?? "—"}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_1fr] gap-2">
                    <div>
                      <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Amount</label>
                      <div className="mt-1 relative">
                        <IndianRupee className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input type="number" inputMode="decimal" min={0} value={d.amount}
                          onChange={(e) => updateDraft(h.id, "amount", e.target.value)}
                          placeholder="0" className={cn("pl-7 glass border-border h-9 text-sm", d.amount !== "" && "ring-1 ring-primary/40")} />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Date</label>
                      <div className="mt-1 relative">
                        <CalendarDays className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input type="date" value={d.entry_date}
                          onChange={(e) => updateDraft(h.id, "entry_date", e.target.value)}
                          className="pl-7 glass border-border h-9 text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Note (optional)</label>
                      <Input value={d.note} onChange={(e) => updateDraft(h.id, "note", e.target.value)}
                        placeholder="Bonus, campaign…" className="mt-1 glass border-border h-9 text-sm" />
                    </div>
                  </div>
                  <Button
                    onClick={() => save(h)}
                    disabled={saving === h.id}
                    className="gradient-primary text-white border-0 h-9"
                  >
                    {saving === h.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1 h-3.5 w-3.5" />}
                    Add
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <Coins className="h-3 w-3 text-primary" />
                  Auto-calculated →
                  <span>Today <span className="font-bold text-foreground">₹{totals.today.toLocaleString("en-IN")}</span></span>·
                  <span>7d <span className="font-bold text-foreground">₹{totals.week.toLocaleString("en-IN")}</span></span>·
                  <span>Month <span className="font-bold text-foreground">₹{totals.month.toLocaleString("en-IN")}</span></span>·
                  <span>Lifetime <span className="font-bold text-foreground">₹{totals.lifetime.toLocaleString("en-IN")}</span></span>
                  {rows.length > 0 && (
                    <button className="ml-auto text-primary underline" onClick={() => setExpanded((e) => ({ ...e, [h.id]: !isOpen }))}>
                      {isOpen ? "Hide" : `View ${rows.length} entries`}
                    </button>
                  )}
                </div>
                {isOpen && rows.length > 0 && (
                  <div className="mt-3 divide-y divide-white/5 rounded-xl border border-white/5 bg-black/20">
                    {rows.map((r) => (
                      <div key={r.id} className="flex items-center justify-between px-3 py-2 text-sm">
                        <span className="text-muted-foreground">{r.entry_date}</span>
                        <span className="font-bold text-sky-300">₹{Number(r.amount).toLocaleString("en-IN")}</span>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeEntry(r.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
        </>
      )}
    </PageShell>
  );
}