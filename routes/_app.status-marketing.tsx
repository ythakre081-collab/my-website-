import { createFileRoute } from "@tanstack/react-router";
import { MarketingStatus } from "@/components/marketing-status";
import { PageShell } from "@/components/page-shell";

export const Route = createFileRoute("/_app/status-marketing")({ component: StatusMarketingPage });

function StatusMarketingPage() {
  return (
    <div className="relative min-h-full overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0f0a1f] via-[#0a0618] to-[#12081f]" />
      <div className="pointer-events-none absolute -top-40 -left-32 h-80 w-80 rounded-full bg-fuchsia-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-32 h-80 w-80 rounded-full bg-indigo-500/15 blur-3xl" />
      <div className="relative">
        <PageShell title="Status Marketing" description="Banners, posters and reels">
          <MarketingStatus />
        </PageShell>
      </div>
    </div>
  );
}