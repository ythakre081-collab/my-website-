import { Sparkles } from "lucide-react";
import { PageShell } from "@/components/page-shell";

export function ComingSoon({ title, description, note }: { title: string; description?: string; note?: string }) {
  return (
    <PageShell title={title} description={description}>
      <div className="glass rounded-3xl p-10 sm:p-16 text-center border border-white/5 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full gradient-primary opacity-20 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full gradient-accent opacity-15 blur-3xl" />
        <div className="relative">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl gradient-primary text-white shadow-lg mb-4">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="text-lg font-bold">Rolling out shortly</div>
          <div className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {note ?? "This module is being built in the next phase with full admin controls, uploads and realtime updates."}
          </div>
        </div>
      </div>
    </PageShell>
  );
}