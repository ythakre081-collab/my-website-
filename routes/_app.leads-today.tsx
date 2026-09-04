import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { LeadsList } from "@/components/leads-list";
import { useLeads } from "@/hooks/use-leads";

export const Route = createFileRoute("/_app/leads-today")({
  component: () => {
    const { leads } = useLeads("today");
    return (
      <PageShell title="Today's Leads" description="Fresh opportunities landed today">
        <LeadsList leads={leads} />
      </PageShell>
    );
  },
});