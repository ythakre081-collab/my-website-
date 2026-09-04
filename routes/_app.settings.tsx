import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { User, Shield, Bell, Palette, ImageIcon } from "lucide-react";
import { BrandLogoEditor } from "@/components/brand-logo-editor";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

function Row({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-4 py-3">
      <div className="min-w-0">
        <div className="font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      {children}
    </div>
  );
}

function SettingsPage() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  return (
    <PageShell title="Settings" description="Manage your account preferences">
      <Tabs defaultValue="profile">
        <TabsList className="glass border border-border flex-wrap h-auto">
          <TabsTrigger value="profile"><User className="mr-1 h-3.5 w-3.5" />Profile</TabsTrigger>
          <TabsTrigger value="security"><Shield className="mr-1 h-3.5 w-3.5" />Security</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="mr-1 h-3.5 w-3.5" />Notifications</TabsTrigger>
          <TabsTrigger value="theme"><Palette className="mr-1 h-3.5 w-3.5" />Theme</TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="branding"><ImageIcon className="mr-1 h-3.5 w-3.5" />Branding</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <div className="glass rounded-2xl p-6 grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Display Name</Label>
              <Input defaultValue="Yogesh Sharma" className="mt-1 glass border-border" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Language</Label>
              <Input defaultValue="English (India)" className="mt-1 glass border-border" />
            </div>
            <Button className="sm:col-span-2 gradient-primary text-white border-0 w-fit">Save</Button>
          </div>
        </TabsContent>

        <TabsContent value="security" className="mt-4">
          <div className="glass rounded-2xl p-6 divide-y divide-border">
            <Row title="Two-factor authentication" desc="Extra security for withdrawals & logins"><Switch defaultChecked /></Row>
            <Row title="Login alerts" desc="Email me when a new device signs in"><Switch defaultChecked /></Row>
            <Row title="Session timeout" desc="Auto sign-out after 30 minutes idle"><Switch /></Row>
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="mt-4">
          <div className="glass rounded-2xl p-6 divide-y divide-border">
            <Row title="New leads" desc="Notify me when a fresh lead lands"><Switch defaultChecked /></Row>
            <Row title="Payout confirmations" desc="Get notified on every payout"><Switch defaultChecked /></Row>
            <Row title="Weekly summary" desc="Email digest every Monday"><Switch /></Row>
            <Row title="WhatsApp group pings" desc="Mentions & announcements"><Switch defaultChecked /></Row>
          </div>
        </TabsContent>

        <TabsContent value="theme" className="mt-4">
          <div className="glass rounded-2xl p-6 divide-y divide-border">
            <Row title="Dark mode" desc="Use the premium dark theme"><Switch defaultChecked /></Row>
            <Row title="Reduced motion" desc="Minimise animations"><Switch /></Row>
            <Row title="Compact spacing" desc="Denser layout for pros"><Switch /></Row>
          </div>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="branding" className="mt-4">
            <BrandLogoEditor />
          </TabsContent>
        )}
      </Tabs>
    </PageShell>
  );
}