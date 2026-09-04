import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { LeadsList } from "@/components/leads-list";
import { useLeads } from "@/hooks/use-leads";

export const Route = createFileRoute("/_app/leads-previous")({
  component: () => {
    const { leads } = useLeads("previous");
    return (
      <PageShell title="Previous Leads" description="Historical lead pipeline">
        <LeadsList leads={leads} />
      </PageShell>
    );
  },
});