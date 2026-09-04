import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Wallet as WalletIcon, Download, TrendingUp, CalendarCheck, CalendarDays, CalendarRange, Infinity as InfinityIcon, Timer, PartyPopper, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/wallet")({
  component: WalletPage,
});

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

type Txn = { id: string; amount: number; type: string; note: string | null; created_at: string };
type Withdraw = { id: string; amount: number; status: string; method: string | null; created_at: string };
type Override = { today: number; week: number; month: number; lifetime: number };
type Daily = { id: string; entry_date: string; amount: number; note: string | null };

function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function daysAgo(n: number) { const d = startOfToday(); d.setDate(d.getDate() - n); return d; }
function startOfMonth() { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; }

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function WalletPage() {
  const { user } = useAuth();
  const [txns, setTxns] = useState<Txn[]>([]);
  const [withdraws, setWithdraws] = useState<Withdraw[]>([]);
  const [override, setOverride] = useState<Override | null>(null);
  const [daily, setDaily] = useState<Daily[]>([]);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [upi, setUpi] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      const [{ data: t }, { data: w }, { data: o }, { data: d }] = await Promise.all([
        supabase.from("wallet_transactions").select("id,amount,type,note,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
        supabase.from("withdraw_requests").select("id,amount,status,method,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
        supabase.from("income_overrides").select("today,week,month,lifetime").eq("user_id", user.id).maybeSingle(),
        supabase.from("daily_income").select("id,entry_date,amount,note").eq("user_id", user.id).order("entry_date", { ascending: false }).limit(200),
      ]);
      if (cancelled) return;
      setTxns((t ?? []) as Txn[]);
      setWithdraws((w ?? []) as Withdraw[]);
      setOverride((o ?? null) as Override | null);
      setDaily((d ?? []) as Daily[]);
    };
    load();
    const ch = supabase
      .channel("wallet_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "wallet_transactions", filter: `user_id=eq.${user.id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "withdraw_requests", filter: `user_id=eq.${user.id}` }, (payload: any) => {
        if (payload.eventType === "UPDATE") {
          const oldStatus = payload.old?.status;
          const newStatus = payload.new?.status;
          const amt = Number(payload.new?.amount ?? 0);
          if (oldStatus !== "approved" && newStatus === "approved") {
            toast.success(
              `✅ Withdrawal Approved — ₹${amt.toLocaleString("en-IN")}\n24 ghante me payment aapke UPI ya bank account me transfer kar diya jayega.`,
              { duration: 10000 },
            );
          } else if (oldStatus !== "rejected" && newStatus === "rejected") {
            toast.error(`Withdrawal request rejected (₹${amt.toLocaleString("en-IN")})`);
          } else if (oldStatus !== "paid" && newStatus === "paid") {
            toast.success(`💸 Payment sent — ₹${amt.toLocaleString("en-IN")}`);
          }
        }
        load();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "income_overrides", filter: `user_id=eq.${user.id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_income", filter: `user_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [user]);

  const totals = useMemo(() => {
    const t0 = startOfToday().getTime();
    const w0 = daysAgo(7).getTime();
    const m0 = startOfMonth().getTime();
    let today = 0, week = 0, month = 0, lifetime = 0, withdrawn = 0;
    for (const t of txns) {
      const ts = new Date(t.created_at).getTime();
      const a = Number(t.amount) || 0;
      if (t.type === "withdraw") { withdrawn += Math.abs(a); continue; }
      lifetime += a;
      if (ts >= t0) today += a;
      if (ts >= w0) week += a;
      if (ts >= m0) month += a;
    }
    for (const d of daily) {
      const ts = new Date(d.entry_date + "T00:00:00").getTime();
      const a = Number(d.amount) || 0;
      lifetime += a;
      if (ts >= t0) today += a;
      if (ts >= w0) week += a;
      if (ts >= m0) month += a;
    }
    for (const w of withdraws) {
      if (w.status === "approved" || w.status === "paid") withdrawn += Number(w.amount) || 0;
    }
    today += Number(override?.today ?? 0);
    week += Number(override?.week ?? 0);
    month += Number(override?.month ?? 0);
    lifetime += Number(override?.lifetime ?? 0);
    const balance = Math.max(0, lifetime - withdrawn);
    return { today, week, month, lifetime, withdrawn, balance };
  }, [txns, withdraws, override, daily]);

  const mergedTxns = useMemo(() => {
    const dailyAsTxn: Txn[] = daily.map((d) => ({
      id: `daily-${d.id}`,
      amount: Number(d.amount) || 0,
      type: "manual_income",
      note: d.note || "Manual income credit",
      created_at: d.entry_date + "T00:00:00",
    }));
    return [...txns, ...dailyAsTxn].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  }, [txns, daily]);

  async function submitWithdraw() {
    if (!user) return;
    const a = Number(amount);
    if (!Number.isFinite(a) || a < 100) { toast.error("Minimum withdrawal is ₹100"); return; }
    if (a > totals.balance) { toast.error("Amount exceeds available balance"); return; }
    setSubmitting(true);
    const { error } = await supabase.from("withdraw_requests").insert({
      user_id: user.id,
      amount: a,
      method: "UPI",
      details: { upi },
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Withdrawal requested — paisa 24 ghante me milega");
    setOpen(false); setAmount(""); setUpi("");
  }

  async function claim(w: Withdraw) {
    const { error } = await supabase.from("withdraw_requests").update({ status: "paid" as any }).eq("id", w.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Paise received ✅");
  }

  const cards = [
    { label: "Today", value: totals.today, icon: CalendarCheck },
    { label: "Last 7 Days", value: totals.week, icon: CalendarDays },
    { label: "This Month", value: totals.month, icon: CalendarRange },
    { label: "Lifetime", value: totals.lifetime, icon: InfinityIcon },
  ];

  return (
    <PageShell title="Wallet" description="Balance, transactions & withdrawals">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-6 sm:p-8 relative overflow-hidden mb-6"
      >
        <div className="absolute -top-24 -right-16 h-64 w-64 rounded-full gradient-primary opacity-30 blur-3xl" />
        <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center relative">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
              <WalletIcon className="h-3.5 w-3.5 text-primary" /> Available Balance
            </div>
            <div className="mt-2 text-4xl sm:text-5xl font-bold text-gradient">{inr(totals.balance)}</div>
            <div className="mt-1 flex items-center gap-1 text-sm text-emerald-400">
              <TrendingUp className="h-3.5 w-3.5" /> Lifetime earnings {inr(totals.lifetime)}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setOpen(true)} className="gradient-primary text-white border-0"><Download className="mr-1 h-4 w-4" /> Withdraw</Button>
            <Button variant="outline" className="border-white/10 bg-white/5">Add Bank</Button>
          </div>
        </div>
      </motion.div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="glass rounded-2xl p-4 border border-white/5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{c.label}</div>
                  <div className="mt-1 text-2xl font-black tracking-tight">{inr(c.value)}</div>
                </div>
                <div className="grid h-10 w-10 place-items-center rounded-xl gradient-primary text-white">
                  <Icon className="h-4 w-4" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Tabs defaultValue="tx">
        <TabsList className="glass border border-border">
          <TabsTrigger value="tx">Transactions</TabsTrigger>
          <TabsTrigger value="history">Payment History</TabsTrigger>
        </TabsList>

        <TabsContent value="tx" className="mt-4">
          <div className="glass rounded-2xl divide-y divide-border">
            {mergedTxns.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No transactions yet.</div>
            ) : mergedTxns.map((t) => {
              const isOut = t.type === "withdraw" || Number(t.amount) < 0;
              const amt = Math.abs(Number(t.amount) || 0);
              return (
                <div key={t.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-4">
                  <div className={cn("grid h-10 w-10 place-items-center rounded-xl", isOut ? "bg-rose-500/20 text-rose-300" : "bg-emerald-500/20 text-emerald-300")}>
                    {isOut ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-medium capitalize">{t.note || t.type}</div>
                    <div className="text-xs text-muted-foreground">{timeAgo(t.created_at)}</div>
                  </div>
                  <div className={cn("font-semibold", isOut ? "text-rose-400" : "text-emerald-400")}>
                    {isOut ? "-" : "+"}{inr(amt)}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <div className="glass rounded-2xl divide-y divide-border">
            {withdraws.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No withdrawals yet.</div>
            ) : withdraws.map((w) => {
              const created = new Date(w.created_at).getTime();
              const readyAt = created + 24 * 60 * 60 * 1000;
              const msLeft = readyAt - now;
              const canClaim = w.status === "pending" && msLeft <= 0;
              const hoursLeft = Math.max(0, Math.ceil(msLeft / (60 * 60 * 1000)));
              return (
                <div key={w.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <div className="font-medium">{w.method || "Withdrawal"}</div>
                    <div className="text-xs text-muted-foreground">{timeAgo(w.created_at)}</div>
                    {w.status === "pending" && !canClaim && (
                      <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-amber-300">
                        <Timer className="h-3 w-3" /> Paise {hoursLeft}h me milega
                      </div>
                    )}
                  </div>
                  {canClaim ? (
                    <Button size="sm" onClick={() => claim(w)} className="gradient-primary text-white border-0 h-8">
                      <PartyPopper className="mr-1 h-3.5 w-3.5" /> Receive Money
                    </Button>
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
                  <div className="font-semibold text-rose-400">-{inr(Number(w.amount))}</div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#0b0d1a] border border-white/10">
          <DialogHeader>
            <DialogTitle>Request Withdrawal</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Amount (₹)</Label>
              <Input type="number" min={100} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Min ₹100" className="mt-1 glass border-border" />
              <div className="mt-1 text-[11px] text-muted-foreground">Available: {inr(totals.balance)}</div>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">UPI ID</Label>
              <Input value={upi} onChange={(e) => setUpi(e.target.value)} placeholder="name@bank" className="mt-1 glass border-border" />
            </div>
            <div className="rounded-lg bg-amber-500/10 border border-amber-400/20 p-3 text-[11px] text-amber-200 flex items-start gap-2">
              <Timer className="h-3.5 w-3.5 mt-0.5" /> Withdrawal ke 24 ghante ke bad "Receive Money" option unlock hoga.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submitWithdraw} disabled={submitting} className="gradient-primary text-white border-0">
              {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}