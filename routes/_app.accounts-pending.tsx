import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { LeadsList } from "@/components/leads-list";
import { useLeads } from "@/hooks/use-leads";

export const Route = createFileRoute("/_app/accounts-pending")({
  component: () => {
    const { leads } = useLeads("pending");
    return (
      <PageShell title="Pending Accounts" description="Awaiting verification or approval">
        <LeadsList leads={leads} />
      </PageShell>
    );
  },
});