import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Crown, Clock3, Phone, RefreshCw, ShieldCheck, CheckCircle2, Sparkles, ChevronLeft, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useBrandLogo } from "@/hooks/use-brand-logo";
import { toast } from "sonner";

export const Route = createFileRoute("/pending")({
  head: () => ({
    meta: [
      { title: "Account Created — YT COMMUNITY ONLINE EARN" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PendingPage,
});

function PendingPage() {
  const navigate = useNavigate();
  const { loading, session, profile } = useAuth();
  const logoUrl = useBrandLogo();

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/auth", replace: true });
    else if (profile?.status === "approved") navigate({ to: "/", replace: true });
  }, [loading, session, profile, navigate]);

  async function refresh() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return navigate({ to: "/auth", replace: true });
    toast.success("Status refreshed");
    window.location.reload();
  }

  async function backToSignIn() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const displayName =
    (profile as { full_name?: string } | null)?.full_name ||
    session?.user?.user_metadata?.full_name ||
    session?.user?.email?.split("@")[0] ||
    "User";

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black text-foreground">
      {/* Red vignette like auth */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(220,38,38,0.18),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[300px] bg-[radial-gradient(ellipse_at_bottom,rgba(239,68,68,0.35),transparent_70%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 py-10">
        {/* Green success banner */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 flex w-full items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"
        >
          <CheckCircle className="h-4 w-4" />
          Registration submitted for approval
        </motion.div>

        {/* Card with rotating gradient border (same as auth) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="relative w-full rounded-[28px] p-[1px] overflow-hidden"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[28px]"
            style={{
              background:
                "linear-gradient(150deg, rgba(251,191,36,0.65), rgba(239,68,68,0.35) 40%, rgba(0,0,0,0) 55%, rgba(239,68,68,0.4) 85%, rgba(251,191,36,0.6))",
            }}
          />

          <div className="relative rounded-[27px] bg-gradient-to-b from-[#1a0908] via-[#120504] to-[#080302] p-6 sm:p-8 text-center">
            {/* Logo */}
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-2xl bg-black/40 ring-1 ring-amber-500/30 overflow-hidden">
              <img src={logoUrl} alt="YT Community Online Earn logo" className="h-full w-full object-contain" />
            </div>

            {/* Premium verification chip */}
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-amber-300">
              <Sparkles className="h-3 w-3" /> Premium Verification
            </div>

            <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl bg-gradient-to-r from-amber-300 via-orange-400 to-pink-500 bg-clip-text text-transparent">
              Account Created
            </h1>
            <p className="mt-2 text-xs uppercase tracking-[0.25em] text-muted-foreground">
              Welcome, {displayName}
            </p>

            {/* Mandatory admin approval notice */}
            <div className="mt-6 rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-500/10 to-orange-500/10 p-4 text-left">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-orange-500 shadow-lg shadow-orange-500/30">
                  <Crown className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold uppercase tracking-widest text-amber-300">
                    Mandatory · Admin Approval
                  </div>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    Aapko jo bhi Demat account links diye gaye the — agar unse aapka account successfully create ho gaya hai, toh <span className="text-amber-300">within 24 hours</span> aapko dashboard access mil jayega.
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Kripya diye gaye links se Demat account banane ki process complete karein aur activation ka intezaar karein.
                  </p>
                </div>
              </div>
            </div>

            {/* Info tiles */}
            <div className="mt-4 grid gap-3">
              <div className="glass rounded-2xl p-4 text-left">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-amber-300">
                  <Clock3 className="h-3.5 w-3.5" /> Verification
                </div>
                <div className="mt-1">
                  <span className="bg-gradient-to-r from-amber-300 to-orange-500 bg-clip-text text-2xl font-black text-transparent">24</span>
                  <span className="ml-2 text-xs uppercase tracking-widest text-muted-foreground">Hours</span>
                </div>
              </div>
              <div className="glass rounded-2xl p-4 text-left">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-pink-300">
                  <Phone className="h-3.5 w-3.5" /> Next Step
                </div>
                <div className="mt-1 font-semibold">Complete Demat account via provided links</div>
              </div>
            </div>

            {/* Progress line: Submitted → Reviewing → Approval */}
            <div className="mt-6">
              <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/10">
                <div className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-gradient-to-r from-fuchsia-500 via-orange-500 to-amber-400" />
              </div>
              <div className="mt-2 grid grid-cols-3 text-[11px] font-semibold uppercase tracking-widest">
                <div className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" /> Submitted
                </div>
                <div className="text-center text-muted-foreground">Reviewing</div>
                <div className="text-right text-muted-foreground">Approval</div>
              </div>
            </div>

            {/* Refresh button */}
            <div className="mt-6">
              <Button
                onClick={refresh}
                variant="outline"
                className="w-full h-12 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 font-semibold"
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Refresh
              </Button>
            </div>

            {/* Trust badges */}
            <div className="mt-5 flex items-center justify-center gap-5 text-xs">
              <span className="inline-flex items-center gap-1.5 text-emerald-400">
                <ShieldCheck className="h-3.5 w-3.5" /> Secure
              </span>
              <span className="inline-flex items-center gap-1.5 text-amber-300">
                <CheckCircle2 className="h-3.5 w-3.5" /> Verified
              </span>
              <span className="inline-flex items-center gap-1.5 text-pink-400">
                <Sparkles className="h-3.5 w-3.5" /> Premium
              </span>
            </div>

            <div className="mt-5 border-t border-white/10 pt-4 text-sm text-muted-foreground">
              Thank you for choosing{" "}
              <span className="bg-gradient-to-r from-amber-300 to-pink-500 bg-clip-text font-semibold text-transparent">
                YT COMMUNITY ONLINE EARN
              </span>
            </div>

            <button
              onClick={backToSignIn}
              className="mt-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" /> Back to sign in
            </button>

            {/* Brand footer */}
            <div className="mt-5 flex items-center justify-center gap-3 border-t border-white/10 pt-4">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/5 overflow-hidden">
                <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" />
              </div>
              <div className="text-left">
                <div className="text-sm font-bold">YT COMMUNITY ONLINE EARN</div>
                <div className="text-[11px] text-muted-foreground">Creator CRM · HR Management</div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}