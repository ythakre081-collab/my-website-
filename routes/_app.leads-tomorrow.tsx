import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { LeadsList } from "@/components/leads-list";
import { useLeads } from "@/hooks/use-leads";

export const Route = createFileRoute("/_app/leads-tomorrow")({
  component: () => {
    const { leads } = useLeads("tomorrow");
    return (
      <PageShell title="Tomorrow's Leads" description="Scheduled follow-ups for tomorrow">
        <LeadsList leads={leads} />
      </PageShell>
    );
  },
});