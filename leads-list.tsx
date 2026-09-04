import { motion } from "framer-motion";
import { Phone, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type LeadStatus =
  | "new"
  | "assigned"
  | "calling"
  | "interested"
  | "not_interested"
  | "follow_up"
  | "joined"
  | "rejected";

export type Lead = {
  id: string;
  name: string;
  mobile: string;
  status: LeadStatus;
  assigned_to: string | null;
  created_at: string;
};

const statusStyles: Record<LeadStatus, string> = {
  new: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  assigned: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  calling: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  interested: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  not_interested: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  follow_up: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  joined: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  rejected: "bg-slate-500/20 text-slate-300 border-slate-500/30",
};

const STATUSES: LeadStatus[] = [
  "new",
  "assigned",
  "calling",
  "interested",
  "not_interested",
  "follow_up",
  "joined",
  "rejected",
];

export function LeadsList({ leads, canEdit = true }: { leads: Lead[]; canEdit?: boolean }) {
  async function updateStatus(id: string, status: LeadStatus) {
    const { error } = await supabase.from("leads").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Status updated");
  }

  async function copyMobile(mobile: string) {
    try {
      await navigator.clipboard.writeText(mobile);
      toast.success(`Copied ${mobile}`);
    } catch {
      toast.error("Copy failed");
    }
  }

  if (leads.length === 0) {
    return (
      <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
        No leads yet. Ask your admin to assign leads.
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {leads.map((l, i) => (
        <motion.div
          key={l.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(i, 10) * 0.03 }}
          whileHover={{ y: -2 }}
          className="glass rounded-2xl p-5 grid gap-4 sm:grid-cols-[1fr_auto] items-center"
        >
          <div className="min-w-0 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl gradient-primary text-white text-sm font-semibold shrink-0">
              {l.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
            </div>
            <div className="min-w-0">
              <div className="truncate font-semibold">{l.name}</div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-0.5 text-xs text-muted-foreground">
                <a href={`tel:${l.mobile}`} className="inline-flex items-center gap-1 hover:text-foreground">
                  <Phone className="h-3 w-3" />{l.mobile}
                </a>
                <button
                  onClick={() => copyMobile(l.mobile)}
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  <Copy className="h-3 w-3" />Copy
                </button>
                <span>{new Date(l.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 justify-end flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={() => copyMobile(l.mobile)}
              className="glass border-border h-8"
            >
              <Copy className="h-3 w-3 mr-1" />Copy Number
            </Button>
            <Badge className={"border capitalize " + statusStyles[l.status]}>
              {l.status.replace("_", " ")}
            </Badge>
            {canEdit && (
              <Select value={l.status} onValueChange={(v) => updateStatus(l.id, v as LeadStatus)}>
                <SelectTrigger className="w-40 glass border-border h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}