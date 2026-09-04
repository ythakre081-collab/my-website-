import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { LeadsList } from "@/components/leads-list";
import { useLeads } from "@/hooks/use-leads";

export const Route = createFileRoute("/_app/accounts-open")({
  component: () => {
    const { leads } = useLeads("open");
    return (
      <PageShell title="Open Accounts" description="Deals ready to be closed">
        <LeadsList leads={leads} />
      </PageShell>
    );
  },
});