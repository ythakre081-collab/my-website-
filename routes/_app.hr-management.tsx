import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Search,
  CheckCircle2,
  XCircle,
  PauseCircle,
  Loader2,
  Eye,
  Copy,
  Mail,
  Phone,
  MapPin,
  BadgeCheck,
  Landmark,
  CreditCard,
  Hash,
  Wallet,
  User as UserIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import type { HrProfile, HrStatus } from "@/hooks/use-auth";

export const Route = createFileRoute("/_app/hr-management")({
  component: HrManagementPage,
});

const statusColor: Record<HrStatus, string> = {
  pending: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  approved: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  rejected: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  suspended: "bg-slate-500/20 text-slate-300 border-slate-500/30",
};

function HrManagementPage() {
  const [rows, setRows] = useState<HrProfile[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<HrProfile | null>(null);
  const [bank, setBank] = useState<Record<string, string | null> | null>(null);
  const [bankLoading, setBankLoading] = useState(false);

  async function load() {
    const { data, error } = await supabase
      .from("hr_profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setRows((data ?? []) as HrProfile[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("hr_profiles_admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "hr_profiles" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  async function openDetails(row: HrProfile) {
    setSelected(row);
    setBank(null);
    setBankLoading(true);
    const { data } = await supabase
      .from("bank_details")
      .select("account_holder_name,bank_name,account_number,ifsc_code,upi_id")
      .eq("user_id", row.id)
      .maybeSingle();
    setBank((data as Record<string, string | null> | null) ?? {});
    setBankLoading(false);
  }

  async function copyText(v: string | null | undefined, label: string) {
    if (!v) return toast.error(`${label} is empty`);
    try {
      await navigator.clipboard.writeText(v);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Copy failed");
    }
  }

  async function copyAll() {
    if (!selected) return;
    const lines = [
      `Name: ${selected.full_name}`,
      `HR Code: ${selected.hr_code ?? "-"}`,
      `Email: ${selected.email}`,
      `Mobile: ${selected.mobile ?? "-"}`,
      `Location: ${[selected.city, selected.state].filter(Boolean).join(", ") || "-"}`,
      `Status: ${selected.status}`,
      "",
      "-- Bank Details --",
      `Account Holder: ${bank?.account_holder_name ?? "-"}`,
      `Bank: ${bank?.bank_name ?? "-"}`,
      `Account No: ${bank?.account_number ?? "-"}`,
      `IFSC: ${bank?.ifsc_code ?? "-"}`,
      `UPI: ${bank?.upi_id ?? "-"}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(lines);
      toast.success("All details copied");
    } catch {
      toast.error("Copy failed");
    }
  }

  const filtered = useMemo(
    () =>
      rows.filter((r) =>
        [r.full_name, r.email, r.mobile, r.hr_code, r.city]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [rows, query],
  );

  async function setStatus(id: string, status: HrStatus) {
    const { error } = await supabase.from("hr_profiles").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else toast.success(`Status updated to ${status}`);
  }

  const counts = {
    total: rows.length,
    pending: rows.filter((r) => r.status === "pending").length,
    approved: rows.filter((r) => r.status === "approved").length,
  };

  return (
    <PageShell title="HR Management" description="Approve, suspend or manage HR accounts">
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {[
          { label: "Total HR", value: counts.total },
          { label: "Pending", value: counts.pending },
          { label: "Approved", value: counts.approved },
        ].map((c) => (
          <div key={c.label} className="glass rounded-2xl p-4">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">{c.label}</div>
            <div className="mt-1 text-2xl font-bold">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email, mobile, HR code…"
          className="pl-9 glass border-border"
        />
      </div>

      {loading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="glass rounded-2xl divide-y divide-border">
          {filtered.length === 0 && (
            <div className="p-8 text-center text-muted-foreground text-sm">No HR found</div>
          )}
          {filtered.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-4 cursor-pointer hover:bg-white/[0.03] transition-colors"
              onClick={() => openDetails(r)}
            >
              <Avatar className="h-10 w-10">
                <AvatarFallback className="gradient-primary text-white text-xs">
                  {r.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold">{r.full_name}</span>
                  <Badge variant="outline" className={statusColor[r.status]}>{r.status}</Badge>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground truncate">
                  {r.email} · {r.mobile ?? "—"} · {r.hr_code}
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openDetails(r)}
                  className="border-white/10"
                >
                  <Eye className="mr-1 h-3.5 w-3.5" /> View
                </Button>
                {r.status !== "approved" && (
                  <Button size="sm" className="gradient-primary text-white border-0" onClick={() => setStatus(r.id, "approved")}>
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Approve
                  </Button>
                )}
                {r.status !== "rejected" && (
                  <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "rejected")}>
                    <XCircle className="mr-1 h-3.5 w-3.5" /> Reject
                  </Button>
                )}
                {r.status !== "suspended" && (
                  <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "suspended")}>
                    <PauseCircle className="mr-1 h-3.5 w-3.5" /> Suspend
                  </Button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl bg-[#0b0d1a] border-white/10 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-3 pr-6">
              <span>HR Details</span>
              <Button size="sm" variant="outline" onClick={copyAll} className="border-white/10">
                <Copy className="mr-1 h-3.5 w-3.5" /> Copy All
              </Button>
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-5">
              <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <Avatar className="h-14 w-14">
                  <AvatarFallback className="gradient-primary text-white">
                    {selected.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="text-lg font-bold text-white truncate">{selected.full_name}</div>
                  <div className="text-xs text-muted-foreground">HR ID · {selected.hr_code ?? "-"}</div>
                </div>
                <Badge variant="outline" className={statusColor[selected.status]}>
                  <BadgeCheck className="mr-1 h-3 w-3" />
                  {selected.status}
                </Badge>
              </div>

              <Section title="Profile">
                <DetailRow icon={<UserIcon className="h-4 w-4" />} label="Full Name" value={selected.full_name} onCopy={copyText} />
                <DetailRow icon={<Hash className="h-4 w-4" />} label="HR Code" value={selected.hr_code} onCopy={copyText} />
                <DetailRow icon={<Mail className="h-4 w-4" />} label="Email" value={selected.email} onCopy={copyText} />
                <DetailRow icon={<Phone className="h-4 w-4" />} label="Mobile" value={selected.mobile} onCopy={copyText} />
                <DetailRow
                  icon={<MapPin className="h-4 w-4" />}
                  label="Location"
                  value={[selected.city, selected.state].filter(Boolean).join(", ") || null}
                  onCopy={copyText}
                />
              </Section>

              <Section title="Bank Details">
                {bankLoading ? (
                  <div className="grid place-items-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : (
                  <>
                    <DetailRow icon={<UserIcon className="h-4 w-4" />} label="Account Holder" value={bank?.account_holder_name} onCopy={copyText} />
                    <DetailRow icon={<Landmark className="h-4 w-4" />} label="Bank Name" value={bank?.bank_name} onCopy={copyText} />
                    <DetailRow icon={<CreditCard className="h-4 w-4" />} label="Account Number" value={bank?.account_number} onCopy={copyText} />
                    <DetailRow icon={<Hash className="h-4 w-4" />} label="IFSC Code" value={bank?.ifsc_code} onCopy={copyText} />
                    <DetailRow icon={<Wallet className="h-4 w-4" />} label="UPI ID" value={bank?.upi_id} onCopy={copyText} />
                  </>
                )}
              </Section>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
      <div className="px-1 pb-2 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
        {title}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
  onCopy,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
  onCopy: (v: string | null | undefined, label: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-white/[0.03]">
      <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/5 text-muted-foreground shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="text-sm text-white truncate">{value || "—"}</div>
      </div>
      <Button
        size="icon"
        variant="ghost"
        onClick={() => onCopy(value, label)}
        className="h-8 w-8 text-muted-foreground hover:text-white"
        aria-label={`Copy ${label}`}
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}