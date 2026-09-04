import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { LiveChatWidget } from "@/components/live-chat-widget";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_app")({
  ssr: false,
  component: AppLayout,
});

function AppLayout() {
  const { loading, session, role, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/auth", replace: true });
      return;
    }
    if (role !== "admin" && profile?.status !== "approved") {
      navigate({ to: "/pending", replace: true });
    }
  }, [loading, session, role, profile, navigate]);

  if (loading || !session || (role !== "admin" && profile?.status !== "approved")) {
    return (
      <div className="grid min-h-screen w-full place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex">
      <div className="hidden lg:block sticky top-0 h-screen">
        <AppSidebar role={role} />
      </div>
      <div className="flex-1 min-w-0 flex flex-col">
        <AppHeader role={role} profile={profile} />
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
      <LiveChatWidget />
    </div>
  );
}