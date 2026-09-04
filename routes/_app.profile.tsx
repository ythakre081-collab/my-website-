import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Camera,
  Loader2,
  Mail,
  Phone,
  MapPin,
  CalendarDays,
  Sparkles,
  ShieldCheck,
  Landmark,
  Crown,
  Save,
  BadgeCheck,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type HrProfile } from "@/hooks/use-auth";
import { toast } from "sonner";
import { logActivity } from "@/lib/activity-log";

export const Route = createFileRoute("/_app/profile")({
  component: ProfilePage,
});

type BankDetails = {
  account_holder_name: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  upi_id: string;
};

const emptyBank: BankDetails = {
  account_holder_name: "",
  bank_name: "",
  account_number: "",
  ifsc_code: "",
  upi_id: "",
};

function ProfilePage() {
  const { user, role, profile: authProfile, loading } = useAuth();
  const [profile, setProfile] = useState<HrProfile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [bank, setBank] = useState<BankDetails>(emptyBank);
  const [bankSaving, setBankSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const isAdmin = role === "admin";

  async function loadProfile() {
    if (!user) return;
    const { data } = await supabase
      .from("hr_profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (data) setProfile(data as HrProfile);
    else if (authProfile) setProfile(authProfile);
    else
      setProfile({
        id: user.id,
        full_name: (user.user_metadata?.full_name as string) ?? user.email ?? "Admin",
        email: user.email ?? "",
        mobile: null,
        city: null,
        state: null,
        hr_code: "ADMIN",
        status: "approved",
        avatar_url: null,
      });
  }

  async function loadBank() {
    if (!user) return;
    const { data } = await supabase
      .from("bank_details")
      .select("account_holder_name,bank_name,account_number,ifsc_code,upi_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      setBank({
        account_holder_name: data.account_holder_name ?? "",
        bank_name: data.bank_name ?? "",
        account_number: data.account_number ?? "",
        ifsc_code: data.ifsc_code ?? "",
        upi_id: data.upi_id ?? "",
      });
    } else {
      setBank({ ...emptyBank, account_holder_name: (authProfile?.full_name ?? "") });
    }
  }

  useEffect(() => {
    loadProfile();
    loadBank();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    async function loadAvatar() {
      if (!profile?.avatar_url) {
        setAvatarUrl(null);
        return;
      }
      const { data } = await supabase.storage
        .from("avatars")
        .createSignedUrl(profile.avatar_url, 60 * 60 * 24);
      if (!cancelled) setAvatarUrl(data?.signedUrl ?? null);
    }
    loadAvatar();
    return () => {
      cancelled = true;
    };
  }, [profile?.avatar_url]);

  const initials = useMemo(
    () =>
      (profile?.full_name ?? user?.email ?? "U")
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase(),
    [profile?.full_name, user?.email],
  );

  async function handleAvatar(file: File) {
    if (!user) return;
    if (!/^image\//.test(file.type)) return toast.error("Please choose an image file");
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be under 5MB");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { error: updErr } = await supabase
        .from("hr_profiles")
        .update({ avatar_url: path })
        .eq("id", user.id);
      if (updErr) throw updErr;
      await loadProfile();
      toast.success("Profile photo updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function saveBank() {
    if (!user) return;
    if (!bank.upi_id.trim()) return toast.error("UPI ID is required");
    setBankSaving(true);
    const payload = {
      user_id: user.id,
      account_holder_name: bank.account_holder_name.trim() || null,
      bank_name: bank.bank_name.trim() || null,
      account_number: bank.account_number.trim() || null,
      ifsc_code: bank.ifsc_code.trim().toUpperCase() || null,
      upi_id: bank.upi_id.trim(),
    };
    const { error } = await supabase
      .from("bank_details")
      .upsert(payload, { onConflict: "user_id" });
    setBankSaving(false);
    if (error) return toast.error(error.message);
    await logActivity({
      action: "profile.bank_updated",
      entity_type: "bank_details",
      entity_id: user.id,
    });
    toast.success("Bank details saved");
  }

  if (loading || !profile) {
    return (
      <PageShell title="Profile" description="Personal information & payouts">
        <div className="grid place-items-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </PageShell>
    );
  }

  const joined = new Date().toLocaleDateString();
  const roleLabel = isAdmin ? "Admin" : "HR Executive";

  return (
    <PageShell title="Profile" description="Your identity & payout details">
      {/* Identity Card with animated gradient border */}
      <GradientBorderCard>
        <div className="p-6">
          <div className="flex flex-wrap items-center gap-5">
            <div className="relative">
              <div className="relative h-24 w-24 rounded-2xl overflow-hidden ring-2 ring-white/10">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-purple-500 to-cyan-400" />
                <Avatar className="relative h-24 w-24 rounded-2xl bg-transparent">
                  {avatarUrl && (
                    <img src={avatarUrl} alt={profile.full_name} className="h-full w-full object-cover" />
                  )}
                  <AvatarFallback className="bg-transparent text-white text-4xl font-bold rounded-2xl">
                    {initials.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-emerald-500 text-white shadow-lg ring-2 ring-background disabled:opacity-60"
                aria-label="Change photo"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleAvatar(f);
                  e.target.value = "";
                }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-2xl md:text-3xl font-bold text-white truncate">{profile.full_name}</div>
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-300 text-sm">
                <Sparkles className="h-3.5 w-3.5" />
                {roleLabel}
              </div>
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="hidden md:inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-muted-foreground hover:bg-white/10"
            >
              <Camera className="h-3.5 w-3.5" /> Change photo
            </button>
          </div>

          <div className="mt-6 space-y-3">
            <ReadRow icon={<Mail className="h-4 w-4" />} label="EMAIL" value={profile.email} />
            <ReadRow icon={<Phone className="h-4 w-4" />} label="MOBILE" value={profile.mobile ?? "—"} />
            <ReadRow
              icon={<MapPin className="h-4 w-4" />}
              label="LOCATION"
              value={[profile.city, profile.state].filter(Boolean).join(", ") || ", ,"}
            />
            <ReadRow icon={<CalendarDays className="h-4 w-4" />} label="JOINED" value={joined} />
          </div>
        </div>
      </GradientBorderCard>

      {/* Bank Details Card */}
      <div className="h-6" />
      <GradientBorderCard>
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-lg">
              <Landmark className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-xl font-bold text-white">Bank Details</div>
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-0.5 text-[11px] font-bold tracking-wider text-amber-300">
                  <Crown className="h-3 w-3" /> PREMIUM
                </span>
              </div>
              <div className="text-sm text-muted-foreground mt-0.5">
                Used for salary & commission payouts.
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            <BankField
              label="ACCOUNT HOLDER NAME"
              value={bank.account_holder_name}
              onChange={(v) => setBank({ ...bank, account_holder_name: v })}
            />
            <BankField
              label="BANK NAME"
              value={bank.bank_name}
              onChange={(v) => setBank({ ...bank, bank_name: v })}
            />
            <BankField
              label="ACCOUNT NUMBER"
              value={bank.account_number}
              onChange={(v) => setBank({ ...bank, account_number: v })}
            />
            <BankField
              label="IFSC CODE"
              value={bank.ifsc_code}
              onChange={(v) => setBank({ ...bank, ifsc_code: v.toUpperCase() })}
            />
            <BankField
              label="UPI ID (REQUIRED)"
              value={bank.upi_id}
              onChange={(v) => setBank({ ...bank, upi_id: v })}
            />
          </div>

          <div className="mt-6 flex justify-end">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={saveBank}
              disabled={bankSaving}
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-white font-semibold shadow-[0_8px_30px_rgba(168,85,247,0.4)] bg-gradient-to-r from-amber-300 via-pink-400 to-indigo-500 disabled:opacity-70"
            >
              {bankSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Bank Details
            </motion.button>
          </div>

          <div className="mt-5 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/5 p-3 text-sm text-muted-foreground">
            <BadgeCheck className="h-4 w-4 text-amber-300 shrink-0 mt-0.5" />
            <span>Payout details are stored securely & used only for your salary and commissions.</span>
          </div>
        </div>
      </GradientBorderCard>
    </PageShell>
  );
}

function GradientBorderCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative rounded-3xl p-[2px] bg-[conic-gradient(from_var(--a,0deg),#f59e0b,#a855f7,#22d3ee,#f59e0b)] [--a:0deg] shadow-[0_20px_60px_-15px_rgba(168,85,247,0.35)]">
      <div className="rounded-[calc(1.5rem-2px)] bg-[#0b0d1a]">{children}</div>
    </div>
  );
}

function ReadRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
      <div className="flex items-center gap-2 text-[11px] font-medium tracking-widest text-muted-foreground">
        <span className="text-muted-foreground/80">{icon}</span>
        {label}
      </div>
      <div className="mt-1 text-white text-base font-medium">{value}</div>
    </div>
  );
}

function BankField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-[11px] font-medium tracking-widest text-muted-foreground">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 rounded-2xl border-white/10 bg-white/[0.03] text-white text-base placeholder:text-muted-foreground/50 focus-visible:ring-purple-500/50"
      />
    </div>
  );
}