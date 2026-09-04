import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, LogIn, LogOut, Clock } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/attendance")({
  component: AttendancePage,
});

const history = [
  { date: "Mon, 10 Nov", in: "09:12", out: "18:24", status: "On time" },
  { date: "Sun, 09 Nov", in: "—", out: "—", status: "Off" },
  { date: "Sat, 08 Nov", in: "09:04", out: "17:50", status: "On time" },
  { date: "Fri, 07 Nov", in: "09:31", out: "18:40", status: "Late" },
  { date: "Thu, 06 Nov", in: "09:00", out: "18:10", status: "On time" },
];

function AttendancePage() {
  const [checkedIn, setCheckedIn] = useState(false);
  const [inTime, setInTime] = useState<string | null>(null);

  const now = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <PageShell title="Attendance" description="Check-in, check-out and history">
      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full gradient-primary opacity-25 blur-2xl" />
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl gradient-primary text-white">
              <LogIn className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Check In</div>
              <div className="text-2xl font-bold">{inTime ?? "—"}</div>
            </div>
          </div>
          <Button
            disabled={checkedIn}
            onClick={() => { setCheckedIn(true); setInTime(now()); }}
            className="mt-5 w-full gradient-primary text-white border-0 disabled:opacity-60"
          >
            {checkedIn ? "Checked In" : "Check In Now"}
          </Button>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full gradient-accent opacity-25 blur-2xl" />
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl gradient-accent text-white">
              <LogOut className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Check Out</div>
              <div className="text-2xl font-bold">—</div>
            </div>
          </div>
          <Button disabled={!checkedIn} variant="outline" className="mt-5 w-full border-white/10 bg-white/5">
            Check Out
          </Button>
        </motion.div>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Attendance History</h3>
        </div>
        <div className="divide-y divide-border">
          {history.map((h, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-5 py-3 text-sm">
              <div className="min-w-0 truncate">{h.date}</div>
              <div className="text-muted-foreground text-xs">In {h.in}</div>
              <div className="text-muted-foreground text-xs">Out {h.out}</div>
              <Badge variant="outline" className="border-white/10 bg-white/5 gap-1">
                <CheckCircle2 className="h-3 w-3" /> {h.status}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}