import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

export const Route = createFileRoute("/_app/logout")({
  component: LogoutPage,
});

function LogoutPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <PageShell title="Sign out" description="Come back soon">
      <div className="glass rounded-3xl p-10 text-center max-w-md mx-auto">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl gradient-primary text-white">
          <LogOut className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-xl font-bold">Ready to sign out?</h3>
        <p className="mt-1 text-sm text-muted-foreground">You'll need to sign in again to access your dashboard.</p>
        <div className="mt-6 flex justify-center gap-2">
          <Button disabled={busy} onClick={signOut} className="gradient-primary text-white border-0">Sign out</Button>
          <Button asChild variant="outline" className="border-white/10 bg-white/5">
            <Link to="/">Cancel</Link>
          </Button>
        </div>
      </div>
    </PageShell>
  );
}