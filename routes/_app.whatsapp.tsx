import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { MessageCircle, Users, ExternalLink } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/whatsapp")({
  component: WhatsAppPage,
});

const groups = [
  { name: "YT Community · Creators HQ", members: 1240, active: true },
  { name: "Leads Alert · North Zone", members: 620, active: true },
  { name: "Payouts & Support", members: 540, active: false },
  { name: "Premium Circle", members: 210, active: true },
  { name: "Weekend Bootcamps", members: 340, active: false },
  { name: "Referral Wins", members: 780, active: true },
];

function WhatsAppPage() {
  return (
    <PageShell title="WhatsApp Groups" description="Join the conversations that matter">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((g, i) => (
          <motion.div
            key={g.name}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            whileHover={{ y: -3 }}
            className="glass rounded-2xl p-5 relative overflow-hidden"
          >
            <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 opacity-20 blur-2xl" />
            <div className="flex items-center justify-between">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white">
                <MessageCircle className="h-5 w-5" />
              </div>
              {g.active && <Badge className="gradient-primary text-white border-0">Active</Badge>}
            </div>
            <div className="mt-4 font-semibold">{g.name}</div>
            <div className="mt-1 text-xs text-muted-foreground inline-flex items-center gap-1">
              <Users className="h-3 w-3" /> {g.members.toLocaleString()} members
            </div>
            <Button size="sm" variant="outline" className="mt-4 w-full border-white/10 bg-white/5">
              Join <ExternalLink className="ml-1 h-3.5 w-3.5" />
            </Button>
          </motion.div>
        ))}
      </div>
    </PageShell>
  );
}