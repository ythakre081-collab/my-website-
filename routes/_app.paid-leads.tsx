import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Copy,
  QrCode,
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Wallet,
  Send,
  IndianRupee,
  Users,
  ShieldCheck,
  Image as ImageIcon,
  Sparkles,
  Zap,
  BadgeCheck,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth, type HrProfile } from "@/hooks/use-auth";
import { parseFile, parsePastedText, type ParsedLead } from "@/lib/lead-parse";

export const Route = createFileRoute("/_app/paid-leads")({
  component: PaidLeadsPage,
});

type Settings = {
  paid_leads_upi: string | null;
  paid_leads_qr_url: string | null;
  paid_leads_price: number | null;
  paid_leads_note: string | null;
};

type PaidRequest = {
  id: string;
  hr_id: string;
  quantity: number;
  amount: number;
  utr: string | null;
  screenshot_url: string | null;
  note: string | null;
  status: "pending" | "verified" | "rejected" | "fulfilled";
  admin_note: string | null;
  leads_uploaded: number | null;
  created_at: string;
  verified_at: string | null;
  fulfilled_at: string | null;
};

function PaidLeadsPage() {
  const { role, user } = useAuth();
  if (!role) {
    return (
      <PageShell title="Paid Leads" description="Loading…">
        <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
          Please wait…
        </div>
      </PageShell>
    );
  }
  return role === "admin" ? <AdminView /> : <HrView userId={user!.id} />;
}

/* ------------------------------- shared bits ------------------------------ */

function StatusBadge({ status }: { status: PaidRequest["status"] }) {
  const map: Record<PaidRequest["status"], { c: string; icon: React.ReactNode; t: string }> = {
    pending: { c: "bg-amber-500/15 text-amber-300 border-amber-500/40", icon: <Clock className="h-3 w-3" />, t: "Pending" },
    verified: { c: "bg-cyan-500/15 text-cyan-300 border-cyan-500/40", icon: <ShieldCheck className="h-3 w-3" />, t: "Verified" },
    fulfilled: { c: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40", icon: <CheckCircle2 className="h-3 w-3" />, t: "Fulfilled" },
    rejected: { c: "bg-rose-500/15 text-rose-300 border-rose-500/40", icon: <XCircle className="h-3 w-3" />, t: "Rejected" },
  };
  const s = map[status];
  return (
    <Badge className={"border inline-flex items-center gap-1 " + s.c}>
      {s.icon}
      {s.t}
    </Badge>
  );
}

async function signUrl(path: string | null | undefined) {
  if (!path) return null;
  const { data } = await supabase.storage.from("paid-leads").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from("app_settings")
        .select("paid_leads_upi,paid_leads_qr_url,paid_leads_price,paid_leads_note")
        .maybeSingle();
      if (cancelled) return;
      const s = (data as Settings) ?? {
        paid_leads_upi: null,
        paid_leads_qr_url: null,
        paid_leads_price: null,
        paid_leads_note: null,
      };
      setSettings(s);
      setQrUrl(await signUrl(s.paid_leads_qr_url));
    }
    load();
    const ch = supabase
      .channel("paid_leads_settings_" + Math.random())
      .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, load)
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, []);
  return { settings, qrUrl };
}

/* ---------------------------------- HR ----------------------------------- */

function HrView({ userId }: { userId: string }) {
  const { settings, qrUrl } = useSettings();
  const [qty, setQty] = useState(50);
  const [utr, setUtr] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<PaidRequest[]>([]);
  const price = Number(settings?.paid_leads_price ?? 10);
  const amount = qty * price;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from("paid_lead_requests")
        .select("*")
        .eq("hr_id", userId)
        .order("created_at", { ascending: false });
      if (!cancelled) setRows((data ?? []) as PaidRequest[]);
    }
    load();
    const ch = supabase
      .channel("hr_paid_req_" + userId)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "paid_lead_requests", filter: `hr_id=eq.${userId}` },
        (payload) => {
          load();
          const n = payload.new as PaidRequest | undefined;
          if (payload.eventType === "UPDATE" && n) {
            if (n.status === "verified") toast.success("Payment verified! Leads jaldi upload honge.");
            if (n.status === "fulfilled") toast.success(`${n.leads_uploaded ?? 0} paid leads mil gaye — Free Leads section me dekho.`);
            if (n.status === "rejected") toast.error(`Request rejected: ${n.admin_note ?? ""}`);
          }
        },
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [userId]);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } catch {
      toast.error("Copy failed");
    }
  }

  async function submit() {
    if (!settings?.paid_leads_upi) return toast.error("Admin ne abhi UPI setup nahi kiya");
    if (qty < 50) return toast.error("Minimum 50 leads chahiye — 50 se kam order nahi hoga");
    if (!utr.trim() && !file) return toast.error("UTR ya payment screenshot me se ek zaroor de");
    setBusy(true);
    let screenshot_url: string | null = null;
    if (file) {
      const path = `screenshots/${userId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("paid-leads").upload(path, file, { upsert: false });
      if (upErr) {
        setBusy(false);
        return toast.error(upErr.message);
      }
      screenshot_url = path;
    }
    const { error } = await supabase.from("paid_lead_requests").insert({
      hr_id: userId,
      quantity: qty,
      amount,
      utr: utr.trim() || null,
      screenshot_url,
      note: note.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setUtr("");
    setNote("");
    setFile(null);
    toast.success("Request submitted — admin verify karke leads bhejenge");
  }

  return (
    <PageShell
      title="Paid Leads"
      description="UPI/QR pe payment karo aur apne verified paid leads paao. Admin verify karte hi leads assign ho jaate hain."
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        {/* Payment card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="group relative rounded-3xl p-[1.5px] shadow-[0_0_80px_-10px_rgba(244,63,94,0.55)]"
        >
          {/* Rotating conic border */}
          <motion.div
            aria-hidden
            className="absolute inset-0 rounded-3xl opacity-90"
            style={{ background: "conic-gradient(from 0deg,#fbbf24,#f43f5e,#a855f7,#f59e0b,#fbbf24)" }}
            animate={{ rotate: 360 }}
            transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
          />
          <div className="relative rounded-[calc(1.5rem-1.5px)] bg-gradient-to-br from-[#1a0f14] via-background/95 to-[#0f0a14] backdrop-blur p-6 space-y-5 overflow-hidden">
            {/* Ambient glow orbs */}
            <div className="pointer-events-none absolute -top-24 -right-16 h-56 w-56 rounded-full bg-amber-500/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-rose-500/20 blur-3xl" />
            {/* Premium ribbon */}
            <div className="absolute right-4 top-4 z-10 flex items-center gap-1 rounded-full border border-amber-400/40 bg-gradient-to-r from-amber-500/20 to-rose-500/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-200 shadow-[0_0_20px_-4px_rgba(251,191,36,0.6)]">
              <Sparkles className="h-3 w-3" /> Premium
            </div>
            <div className="relative flex items-center gap-3">
              <div className="relative grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-amber-500/30 to-rose-500/30 border border-amber-400/40 shadow-[0_0_20px_-2px_rgba(251,191,36,0.5)]">
                <QrCode className="h-5 w-5 text-amber-200" />
                <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-emerald-500 text-white text-[9px]">
                  <BadgeCheck className="h-3 w-3" />
                </span>
              </div>
              <div>
                <div className="font-bold text-base bg-gradient-to-r from-amber-200 via-rose-200 to-fuchsia-200 bg-clip-text text-transparent">Scan & Pay Securely</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3 text-emerald-400" /> GPay · PhonePe · Paytm · Any UPI
                </div>
              </div>
            </div>

            <div className="relative grid gap-4 sm:grid-cols-[auto_1fr] items-center">
              <div className="relative mx-auto sm:mx-0">
                {/* Corner brackets */}
                <span className="absolute -left-1 -top-1 h-4 w-4 border-l-2 border-t-2 border-amber-400 rounded-tl" />
                <span className="absolute -right-1 -top-1 h-4 w-4 border-r-2 border-t-2 border-amber-400 rounded-tr" />
                <span className="absolute -left-1 -bottom-1 h-4 w-4 border-l-2 border-b-2 border-amber-400 rounded-bl" />
                <span className="absolute -right-1 -bottom-1 h-4 w-4 border-r-2 border-b-2 border-amber-400 rounded-br" />
                <div className="grid h-48 w-48 place-items-center rounded-2xl border border-amber-400/20 bg-white/[0.03] overflow-hidden shadow-[0_0_30px_-8px_rgba(251,191,36,0.5)]">
                  {qrUrl ? (
                    <img src={qrUrl} alt="Payment QR" className="h-full w-full object-contain p-2 bg-white" />
                  ) : (
                    <div className="text-center text-xs text-muted-foreground p-4">
                      <ImageIcon className="mx-auto mb-2 h-8 w-8 opacity-50" />
                      Admin ne abhi QR upload nahi kiya
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-muted-foreground">UPI ID</div>
                  <div className="mt-1 flex items-center gap-2 rounded-xl border border-amber-400/20 bg-gradient-to-r from-amber-500/[0.06] to-rose-500/[0.06] px-3 py-2">
                    <span className="font-mono text-sm truncate flex-1">
                      {settings?.paid_leads_upi ?? "Not set"}
                    </span>
                    {settings?.paid_leads_upi && (
                      <Button size="sm" variant="ghost" className="h-7 px-2 hover:bg-amber-500/20" onClick={() => copy(settings.paid_leads_upi!)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Price / Lead</div>
                  <div className="mt-1 text-3xl font-black flex items-center bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(251,191,36,0.4)]">
                    <IndianRupee className="h-6 w-6 text-amber-300" />
                    {price}
                  </div>
                </div>
                {settings?.paid_leads_note && (
                  <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-amber-500/40 pl-3">
                    {settings.paid_leads_note}
                  </p>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Request form */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="relative rounded-3xl p-[1.5px] bg-gradient-to-br from-fuchsia-500/50 via-rose-500/30 to-amber-500/50 shadow-[0_0_60px_-15px_rgba(217,70,239,0.45)]"
        >
          <div className="relative rounded-[calc(1.5rem-1.5px)] bg-gradient-to-br from-[#12081a] via-background/95 to-[#0e0916] p-6 space-y-4 overflow-hidden">
            <div className="pointer-events-none absolute -top-24 -left-16 h-52 w-52 rounded-full bg-fuchsia-500/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -right-16 h-52 w-52 rounded-full bg-amber-500/15 blur-3xl" />
            <div className="relative flex items-center gap-2">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-fuchsia-500/30 to-rose-500/30 border border-fuchsia-400/40 shadow-[0_0_18px_-4px_rgba(217,70,239,0.6)]">
                <Send className="h-4 w-4 text-fuchsia-200" />
              </div>
              <div>
                <div className="font-bold bg-gradient-to-r from-fuchsia-200 via-rose-200 to-amber-200 bg-clip-text text-transparent">Submit Payment Request</div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-1"><Zap className="h-3 w-3 text-amber-300" /> Verify hote hi leads assign</div>
              </div>
            </div>

          <div className="relative grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Quantity</Label>
              <Input
                type="number"
                min={50}
                value={qty}
                onChange={(e) => setQty(Math.max(50, Number(e.target.value) || 50))}
                className="mt-1 glass border-amber-400/30 focus-visible:ring-amber-400/40 text-lg font-bold"
              />
              <p className="mt-1 text-[11px] font-semibold text-amber-300">Minimum 50 leads se kam nahi milenga</p>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Total Amount</Label>
              <div className="mt-1 flex h-10 items-center rounded-xl border border-emerald-400/30 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 px-3 font-black text-lg text-emerald-300 shadow-[inset_0_0_20px_-8px_rgba(16,185,129,0.4)]">
                <IndianRupee className="h-4 w-4" />
                {amount.toLocaleString("en-IN")}
              </div>
            </div>
          </div>

          <div className="relative">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">UTR / Transaction ID</Label>
            <Input
              value={utr}
              onChange={(e) => setUtr(e.target.value)}
              placeholder="12-digit UPI reference"
              className="mt-1 glass border-fuchsia-400/25 focus-visible:ring-fuchsia-400/40 font-mono tracking-wider"
            />
          </div>

          <div className="relative">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Payment Screenshot</Label>
            <label className="group/upload mt-1 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-fuchsia-400/30 bg-gradient-to-r from-fuchsia-500/[0.04] to-amber-500/[0.04] px-3 py-3 hover:border-fuchsia-400/60 hover:from-fuchsia-500/10 hover:to-amber-500/10 transition-all">
              <Upload className="h-4 w-4 text-fuchsia-300 group-hover/upload:scale-110 transition-transform" />
              <span className="text-sm truncate flex-1">
                {file ? file.name : "Click to upload screenshot"}
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          <div className="relative">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Note (optional)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Any message for admin…"
              className="mt-1 glass border-fuchsia-400/20 focus-visible:ring-fuchsia-400/40"
            />
          </div>

          <Button
            onClick={submit}
            disabled={busy}
            className="relative w-full h-12 bg-gradient-to-r from-amber-500 via-rose-500 to-fuchsia-600 text-white border-0 shadow-[0_0_40px_-4px_rgba(244,63,94,0.7)] font-bold text-base overflow-hidden group/btn"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700" />
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wallet className="mr-2 h-4 w-4" />}
            Submit Request · ₹{amount.toLocaleString("en-IN")}
          </Button>
          </div>
        </motion.div>
      </div>

      {/* History */}
      <div className="relative mt-8 rounded-3xl p-[1px] bg-gradient-to-br from-amber-500/30 via-rose-500/20 to-fuchsia-500/30">
        <div className="rounded-[calc(1.5rem-1px)] bg-background/80 backdrop-blur p-6">
        <div className="mb-4 flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-amber-500/20 to-fuchsia-500/20 border border-amber-400/30">
            <Clock className="h-4 w-4 text-amber-300" />
          </div>
          <div className="font-bold bg-gradient-to-r from-amber-200 to-fuchsia-200 bg-clip-text text-transparent">My Requests</div>
        </div>
        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-amber-400/20 bg-gradient-to-br from-amber-500/[0.03] to-fuchsia-500/[0.03] py-12 text-center text-sm text-muted-foreground">
            <Sparkles className="mx-auto mb-2 h-6 w-6 text-amber-400/60" />
            Abhi tak koi request nahi. Payment karo aur upar form fill karo.
          </div>
        ) : (
          <div className="grid gap-3">
            {rows.map((r) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                className="group/row rounded-2xl border border-amber-400/15 bg-gradient-to-r from-white/[0.02] to-amber-500/[0.03] p-4 grid gap-2 sm:grid-cols-[1fr_auto] items-center hover:border-amber-400/30 hover:shadow-[0_0_25px_-8px_rgba(251,191,36,0.4)] transition-all"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-base">
                      <span className="text-amber-200">{r.quantity}</span> leads · <span className="text-emerald-300">₹{Number(r.amount).toLocaleString("en-IN")}</span>
                    </span>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                    {r.utr && <> · UTR: <span className="font-mono">{r.utr}</span></>}
                  </div>
                  {r.admin_note && (
                    <div className="mt-1 text-xs text-amber-300">Admin: {r.admin_note}</div>
                  )}
                  {r.status === "fulfilled" && (
                    <div className="mt-1 text-xs text-emerald-300">
                      ✓ {r.leads_uploaded ?? r.quantity} leads assigned — check Free Leads section
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
        </div>
      </div>
    </PageShell>
  );
}

/* --------------------------------- Admin --------------------------------- */

function AdminView() {
  return (
    <PageShell
      title="Paid Leads"
      description="QR/UPI settings, HR payment requests aur verified requests ke liye lead upload."
    >
      <div className="relative rounded-3xl p-[1.5px] shadow-[0_0_60px_-15px_rgba(244,63,94,0.4)] overflow-hidden">
        <motion.div
          aria-hidden
          className="absolute inset-0 rounded-3xl opacity-80"
          style={{ background: "conic-gradient(from 0deg,#fbbf24,#f43f5e,#a855f7,#f59e0b,#fbbf24)" }}
          animate={{ rotate: 360 }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
        />
        <div className="relative rounded-[calc(1.5rem-1.5px)] bg-gradient-to-br from-[#12081a] via-background/95 to-[#0f0a14] p-5 sm:p-6 overflow-hidden">
          <div className="pointer-events-none absolute -top-24 -right-16 h-56 w-56 rounded-full bg-amber-500/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-fuchsia-500/15 blur-3xl" />
          <div className="absolute right-4 top-4 z-10 hidden sm:flex items-center gap-1 rounded-full border border-amber-400/40 bg-gradient-to-r from-amber-500/20 to-rose-500/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-200 shadow-[0_0_18px_-4px_rgba(251,191,36,0.6)]">
            <Sparkles className="h-3 w-3" /> Admin Control
          </div>
          <Tabs defaultValue="requests" className="relative">
            <TabsList className="glass border border-amber-400/25 bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-fuchsia-500/10 p-1 h-auto">
              <TabsTrigger value="requests" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-rose-500 data-[state=active]:text-white data-[state=active]:shadow-[0_0_20px_-4px_rgba(244,63,94,0.6)] font-semibold">
                Requests
              </TabsTrigger>
              <TabsTrigger value="settings" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-fuchsia-500 data-[state=active]:to-amber-500 data-[state=active]:text-white data-[state=active]:shadow-[0_0_20px_-4px_rgba(217,70,239,0.6)] font-semibold">
                QR / UPI Settings
              </TabsTrigger>
            </TabsList>
            <TabsContent value="requests" className="mt-5">
              <AdminRequests />
            </TabsContent>
            <TabsContent value="settings" className="mt-5">
              <AdminSettings />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </PageShell>
  );
}

function AdminSettings() {
  const [upi, setUpi] = useState("");
  const [price, setPrice] = useState<number>(10);
  const [note, setNote] = useState("");
  const [qrPath, setQrPath] = useState<string | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("app_settings")
      .select("paid_leads_upi,paid_leads_qr_url,paid_leads_price,paid_leads_note")
      .maybeSingle()
      .then(async ({ data }) => {
        const s = data as Settings | null;
        setUpi(s?.paid_leads_upi ?? "");
        setPrice(Number(s?.paid_leads_price ?? 10));
        setNote(s?.paid_leads_note ?? "");
        setQrPath(s?.paid_leads_qr_url ?? null);
        setQrPreview(await signUrl(s?.paid_leads_qr_url));
      });
  }, []);

  async function uploadQr(f: File) {
    setUploading(true);
    const path = `qr/${Date.now()}-${f.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await supabase.storage.from("paid-leads").upload(path, f, { upsert: true });
    setUploading(false);
    if (error) return toast.error(error.message);
    setQrPath(path);
    setQrPreview(await signUrl(path));
    toast.success("QR uploaded — save karna mat bhoolna");
  }

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .update({
        paid_leads_upi: upi.trim() || null,
        paid_leads_qr_url: qrPath,
        paid_leads_price: price,
        paid_leads_note: note.trim() || null,
      })
      .eq("id", true);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Settings saved");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <div className="relative rounded-3xl p-[1px] bg-gradient-to-br from-amber-500/40 via-rose-500/25 to-fuchsia-500/40 shadow-[0_0_40px_-15px_rgba(251,191,36,0.45)]">
        <div className="rounded-[calc(1.5rem-1px)] bg-background/90 backdrop-blur p-6 space-y-4">
        <div className="font-bold flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-amber-500/25 to-rose-500/25 border border-amber-400/40">
            <QrCode className="h-4 w-4 text-amber-200" />
          </div>
          <span className="bg-gradient-to-r from-amber-200 to-rose-200 bg-clip-text text-transparent">Payment Details</span>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">UPI ID</Label>
          <Input value={upi} onChange={(e) => setUpi(e.target.value)} placeholder="yourname@ybl" className="mt-1 glass border-amber-400/25 focus-visible:ring-amber-400/40 font-mono" />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Price per Lead (₹)</Label>
          <Input type="number" min={1} value={price} onChange={(e) => setPrice(Number(e.target.value) || 0)} className="mt-1 glass border-amber-400/25 focus-visible:ring-amber-400/40 text-lg font-bold" />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Note for HRs</Label>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="e.g. Payment karne ke baad UTR upload karo. 24 hours me leads mil jayenge." className="mt-1 glass border-amber-400/25 focus-visible:ring-amber-400/40" />
        </div>
        <Button onClick={save} disabled={saving} className="relative w-full h-11 bg-gradient-to-r from-amber-500 via-rose-500 to-fuchsia-600 text-white border-0 shadow-[0_0_30px_-4px_rgba(244,63,94,0.6)] font-bold overflow-hidden group/save">
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover/save:translate-x-full transition-transform duration-700" />
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
          Save Settings
        </Button>
        </div>
      </div>

      <div className="relative rounded-3xl p-[1px] bg-gradient-to-br from-fuchsia-500/40 via-rose-500/25 to-amber-500/40 shadow-[0_0_40px_-15px_rgba(217,70,239,0.45)]">
        <div className="rounded-[calc(1.5rem-1px)] bg-background/90 backdrop-blur p-6 space-y-4">
          <div className="font-bold flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-fuchsia-500/25 to-amber-500/25 border border-fuchsia-400/40">
              <ImageIcon className="h-4 w-4 text-fuchsia-200" />
            </div>
            <span className="bg-gradient-to-r from-fuchsia-200 to-amber-200 bg-clip-text text-transparent">QR Code Image</span>
          </div>
          <div className="relative mx-auto">
            <span className="absolute -left-1 -top-1 h-4 w-4 border-l-2 border-t-2 border-fuchsia-400 rounded-tl" />
            <span className="absolute -right-1 -top-1 h-4 w-4 border-r-2 border-t-2 border-fuchsia-400 rounded-tr" />
            <span className="absolute -left-1 -bottom-1 h-4 w-4 border-l-2 border-b-2 border-fuchsia-400 rounded-bl" />
            <span className="absolute -right-1 -bottom-1 h-4 w-4 border-r-2 border-b-2 border-fuchsia-400 rounded-br" />
            <div className="grid h-64 place-items-center rounded-2xl border border-fuchsia-400/20 bg-white/[0.03] overflow-hidden shadow-[0_0_30px_-8px_rgba(217,70,239,0.4)]">
              {qrPreview ? (
                <img src={qrPreview} alt="QR" className="h-full w-full object-contain p-2 bg-white" />
              ) : (
                <div className="text-center text-sm text-muted-foreground p-6">
                  <ImageIcon className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  No QR uploaded
                </div>
              )}
            </div>
          </div>
          <label className="group/up flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-fuchsia-400/30 bg-gradient-to-r from-fuchsia-500/[0.05] to-amber-500/[0.05] px-3 py-3 hover:border-fuchsia-400/60 hover:from-fuchsia-500/10 hover:to-amber-500/10 transition-all">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 text-fuchsia-300 group-hover/up:scale-110 transition-transform" />}
            <span className="text-sm flex-1 font-medium">Upload / Replace QR image</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadQr(e.target.files[0])}
            />
          </label>
          <p className="text-[11px] text-amber-300/80 font-medium">⚡ Save Settings dabana zaroor — tabhi HR ko dikhega.</p>
        </div>
      </div>
    </div>
  );
}

function AdminRequests() {
  const [rows, setRows] = useState<PaidRequest[]>([]);
  const [hrs, setHrs] = useState<Record<string, HrProfile>>({});
  const [tab, setTab] = useState<"pending" | "verified" | "history">("pending");
  const [screenshotOf, setScreenshotOf] = useState<PaidRequest | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [uploadFor, setUploadFor] = useState<PaidRequest | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from("paid_lead_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (cancelled) return;
      const list = (data ?? []) as PaidRequest[];
      setRows(list);
      const ids = Array.from(new Set(list.map((r) => r.hr_id)));
      if (ids.length) {
        const { data: profs } = await supabase.from("hr_profiles").select("*").in("id", ids);
        const map: Record<string, HrProfile> = {};
        (profs ?? []).forEach((p) => (map[(p as HrProfile).id] = p as HrProfile));
        setHrs(map);
      }
    }
    load();
    const ch = supabase
      .channel("admin_paid_req_" + Math.random())
      .on("postgres_changes", { event: "*", schema: "public", table: "paid_lead_requests" }, (payload) => {
        load();
        if (payload.eventType === "INSERT") toast.success("New paid-lead request received");
      })
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const u = await signUrl(screenshotOf?.screenshot_url);
      if (!cancelled) setScreenshotUrl(u);
    })();
    return () => { cancelled = true; };
  }, [screenshotOf]);

  const filtered = useMemo(() => {
    if (tab === "pending") return rows.filter((r) => r.status === "pending");
    if (tab === "verified") return rows.filter((r) => r.status === "verified");
    return rows.filter((r) => r.status === "fulfilled" || r.status === "rejected");
  }, [rows, tab]);

  async function verify(r: PaidRequest) {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("paid_lead_requests")
      .update({ status: "verified", verified_by: user?.id, verified_at: new Date().toISOString() })
      .eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Verified — ab leads upload karo");
  }

  async function reject(r: PaidRequest) {
    const reason = window.prompt("Reject reason (HR ko dikhega):", "Payment verify nahi hui");
    if (reason === null) return;
    const { error } = await supabase
      .from("paid_lead_requests")
      .update({ status: "rejected", admin_note: reason })
      .eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Rejected");
  }

  async function remove(r: PaidRequest) {
    if (!window.confirm(`Ye request delete kar dun? Ye action wapas nahi hoga.`)) return;
    const { error } = await supabase.from("paid_lead_requests").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    setRows((prev) => prev.filter((x) => x.id !== r.id));
    toast.success("Request deleted");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {(["pending", "verified", "history"] as const).map((t) => (
          <Button
            key={t}
            size="sm"
            variant={tab === t ? "default" : "outline"}
            onClick={() => setTab(t)}
            className={tab === t
              ? (t === "pending"
                  ? "bg-gradient-to-r from-amber-500 to-rose-500 text-white border-0 shadow-[0_0_20px_-4px_rgba(244,63,94,0.6)]"
                  : t === "verified"
                    ? "bg-gradient-to-r from-cyan-500 to-emerald-500 text-white border-0 shadow-[0_0_20px_-4px_rgba(16,185,129,0.6)]"
                    : "bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white border-0 shadow-[0_0_20px_-4px_rgba(217,70,239,0.6)]")
              : "glass border-amber-400/20 hover:border-amber-400/40"}
          >
            {t === "pending" ? "Pending" : t === "verified" ? "Verified" : "History"}
            <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-black/25">
              {rows.filter((r) =>
                t === "pending" ? r.status === "pending" : t === "verified" ? r.status === "verified" : r.status === "fulfilled" || r.status === "rejected",
              ).length}
            </span>
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-amber-400/20 bg-gradient-to-br from-amber-500/[0.03] to-fuchsia-500/[0.03] py-14 text-center text-sm text-muted-foreground">
          <Sparkles className="mx-auto mb-2 h-6 w-6 text-amber-400/60" />
          No requests here.
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((r) => {
            const hr = hrs[r.hr_id];
            return (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-amber-400/15 bg-gradient-to-r from-white/[0.02] via-amber-500/[0.03] to-fuchsia-500/[0.03] p-4 grid gap-3 sm:grid-cols-[1fr_auto] items-center hover:border-amber-400/35 hover:shadow-[0_0_25px_-8px_rgba(251,191,36,0.4)] transition-all"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{hr?.full_name ?? "HR"}</span>
                    <span className="text-xs text-muted-foreground">{hr?.hr_code}</span>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="mt-1 text-sm">
                    <span className="font-semibold text-amber-300">{r.quantity} leads</span>
                    <span className="text-muted-foreground"> · ₹{Number(r.amount).toLocaleString("en-IN")}</span>
                    {r.utr && <span className="text-muted-foreground"> · UTR: <span className="font-mono">{r.utr}</span></span>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                    {r.note && <> · {r.note}</>}
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  {r.screenshot_url && (
                    <Button size="sm" variant="outline" className="glass border-border" onClick={() => setScreenshotOf(r)}>
                      <ImageIcon className="h-3.5 w-3.5 mr-1" /> Screenshot
                    </Button>
                  )}
                  {r.status === "pending" && (
                    <>
                      <Button size="sm" variant="outline" className="glass border-border text-rose-300" onClick={() => reject(r)}>
                        <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                      </Button>
                      <Button size="sm" className="bg-gradient-to-r from-cyan-500 to-emerald-500 text-white shadow-[0_0_18px_-4px_rgba(16,185,129,0.6)]" onClick={() => verify(r)}>
                        <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Verify
                      </Button>
                    </>
                  )}
                  {r.status === "verified" && (
                    <Button size="sm" className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-[0_0_18px_-4px_rgba(16,185,129,0.6)]" onClick={() => setUploadFor(r)}>
                      <Upload className="h-3.5 w-3.5 mr-1" /> Upload Leads
                    </Button>
                  )}
                  {r.status === "fulfilled" && (
                    <span className="text-xs text-emerald-300 inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" /> {r.leads_uploaded ?? r.quantity} assigned
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="glass border-rose-500/40 text-rose-300 hover:bg-rose-500/10"
                    onClick={() => remove(r)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Screenshot preview */}
      <Dialog open={!!screenshotOf} onOpenChange={(o) => !o && setScreenshotOf(null)}>
        <DialogContent className="glass max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payment Screenshot</DialogTitle>
            <DialogDescription>
              {screenshotOf ? `${hrs[screenshotOf.hr_id]?.full_name ?? "HR"} · ₹${Number(screenshotOf.amount).toLocaleString("en-IN")}` : ""}
            </DialogDescription>
          </DialogHeader>
          {screenshotUrl ? (
            <img src={screenshotUrl} alt="Screenshot" className="w-full max-h-[70vh] object-contain rounded-xl bg-black/50" />
          ) : (
            <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
          )}
        </DialogContent>
      </Dialog>

      {/* Upload leads dialog */}
      {uploadFor && (
        <UploadLeadsDialog
          request={uploadFor}
          hrName={hrs[uploadFor.hr_id]?.full_name ?? "HR"}
          onClose={() => setUploadFor(null)}
        />
      )}
    </div>
  );
}

function UploadLeadsDialog({
  request,
  hrName,
  onClose,
}: {
  request: PaidRequest;
  hrName: string;
  onClose: () => void;
}) {
  const [pasted, setPasted] = useState("");
  const [preview, setPreview] = useState<ParsedLead[]>([]);
  const [bucket, setBucket] = useState<"today" | "tomorrow">("today");
  const [busy, setBusy] = useState(false);

  function doParsePaste() {
    setPreview(parsePastedText(pasted));
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const rows = await parseFile(f);
      setPreview(rows);
    } catch {
      toast.error("Failed to parse file");
    } finally {
      e.target.value = "";
    }
  }

  async function upload() {
    if (!preview.length) return toast.error("Add leads first");
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    const rows = preview.map((l) => ({
      name: l.name,
      mobile: l.mobile,
      bucket,
      status: "assigned" as const,
      assigned_to: request.hr_id,
      assigned_at: new Date().toISOString(),
      created_by: user?.id ?? null,
    }));
    let inserted = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { data, error } = await supabase
        .from("leads")
        .upsert(chunk, { onConflict: "mobile", ignoreDuplicates: true })
        .select("id");
      if (error) {
        setBusy(false);
        return toast.error(error.message);
      }
      inserted += data?.length ?? 0;
    }
    const { error: uErr } = await supabase
      .from("paid_lead_requests")
      .update({
        status: "fulfilled",
        fulfilled_at: new Date().toISOString(),
        leads_uploaded: inserted,
      })
      .eq("id", request.id);
    setBusy(false);
    if (uErr) return toast.error(uErr.message);
    toast.success(`Uploaded ${inserted} leads to ${hrName}`);
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass max-w-3xl">
        <DialogHeader>
          <DialogTitle>Upload Paid Leads → {hrName}</DialogTitle>
          <DialogDescription>
            Paid for {request.quantity} leads · ₹{Number(request.amount).toLocaleString("en-IN")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Bucket</Label>
              <Select value={bucket} onValueChange={(v) => setBucket(v as "today" | "tomorrow")}>
                <SelectTrigger className="mt-1 glass border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today's Leads</SelectItem>
                  <SelectItem value="tomorrow">Tomorrow's Leads</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Upload File</Label>
              <label className="mt-1 flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-3 hover:border-primary/50">
                <Upload className="h-4 w-4 text-primary" />
                <span className="text-xs">CSV / XLSX</span>
                <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onFile} />
              </label>
            </div>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Or Paste Leads</Label>
            <Textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              rows={6}
              placeholder="Name, Mobile\nJohn, 9876543210"
              className="mt-1 glass border-border font-mono text-xs"
            />
            <Button size="sm" variant="outline" className="mt-2 glass border-border" onClick={doParsePaste}>Parse</Button>
          </div>

          {preview.length > 0 && (
            <div className="rounded-xl border border-border max-h-56 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-xs uppercase text-muted-foreground">
                  <tr><th className="px-3 py-2 text-left">Name</th><th className="px-3 py-2 text-left">Mobile</th></tr>
                </thead>
                <tbody>
                  {preview.slice(0, 200).map((l) => (
                    <tr key={l.mobile} className="border-t border-border">
                      <td className="px-3 py-1.5">{l.name}</td>
                      <td className="px-3 py-1.5 font-mono text-xs">{l.mobile}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Button
            onClick={upload}
            disabled={busy || !preview.length}
            className="w-full h-11 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white border-0"
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Upload {preview.length || ""} lead{preview.length === 1 ? "" : "s"} & Mark Fulfilled
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}