import { motion } from "framer-motion";
import { Bell, Menu, Moon, Sun, Crown, Gift, Wallet, UserCheck } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AppSidebar } from "./app-sidebar";
import type { AppRole, HrProfile } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

function todayString() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function AppHeader({ role, profile }: { role: AppRole | null; profile: HrProfile | null }) {
  const [dark, setDark] = useState(true);
  const [open, setOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [pendingWd, setPendingWd] = useState<number>(0);
  const [pendingHr, setPendingHr] = useState<number>(0);
  const [announcements, setAnnouncements] = useState<Array<{ id: string; title: string; body: string | null; priority: string | null; published_at: string | null; created_at: string }>>([]);
  const [lastRead, setLastRead] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return Number(localStorage.getItem("ann_last_read") ?? 0);
  });
  const [notifOpen, setNotifOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from("announcements")
        .select("id,title,body,priority,published_at,created_at")
        .order("created_at", { ascending: false })
        .limit(15);
      if (!cancelled) setAnnouncements((data as any) ?? []);
    }
    load();
    const ch = supabase
      .channel("hdr_announcements")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, (payload: any) => {
        load();
        if (payload.eventType === "INSERT") {
          const title = payload?.new?.title ?? "New announcement";
          import("sonner").then(({ toast }) => toast.success(`📢 ${title}`));
        }
      })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    if (role !== "admin") return;
    let cancelled = false;
    async function count() {
      const { count: c } = await supabase
        .from("withdraw_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (!cancelled) setPendingWd(c ?? 0);
    }
    count();
    const ch = supabase
      .channel("hdr_withdraws")
      .on("postgres_changes", { event: "*", schema: "public", table: "withdraw_requests" }, (payload: any) => {
        if (payload.eventType === "INSERT" && payload?.new?.status === "pending") {
          const amt = Number(payload?.new?.amount ?? 0);
          import("sonner").then(({ toast }) =>
            toast.success(`New withdrawal: ₹${amt.toLocaleString("en-IN")}`, { icon: "💸" }),
          );
        }
        count();
      })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [role]);

  useEffect(() => {
    if (role !== "admin") return;
    let cancelled = false;
    async function count() {
      const { count: c } = await supabase
        .from("hr_profiles")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (!cancelled) setPendingHr(c ?? 0);
    }
    count();
    const ch = supabase
      .channel("hdr_hr_pending")
      .on("postgres_changes", { event: "*", schema: "public", table: "hr_profiles" }, (payload: any) => {
        if (payload.eventType === "INSERT" && payload?.new?.status === "pending") {
          const name = payload?.new?.full_name ?? "New HR";
          import("sonner").then(({ toast }) =>
            toast.success(`New HR signup: ${name}`, { icon: "🧑‍💼" }),
          );
        }
        count();
      })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [role]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!profile?.avatar_url) {
        setAvatarUrl(null);
        return;
      }
      const { data } = await supabase.storage
        .from("avatars")
        .createSignedUrl(profile.avatar_url, 60 * 60 * 24);
      if (!cancelled) setAvatarUrl(data?.signedUrl ?? null);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [profile?.avatar_url]);

  const initials = (profile?.full_name ?? "U")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const unreadCount = announcements.filter((a) => {
    const t = new Date(a.published_at ?? a.created_at).getTime();
    return t > lastRead;
  }).length;

  function markAllRead() {
    const now = Date.now();
    setLastRead(now);
    if (typeof window !== "undefined") localStorage.setItem("ann_last_read", String(now));
  }

  const toggleTheme = () => {
    setDark((d) => {
      document.documentElement.classList.toggle("dark", !d);
      return !d;
    });
  };

  return (
    <motion.header
      initial={{ y: -12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="sticky top-0 z-30 glass border-b border-border relative"
    >
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Open menu"
                className="lg:hidden h-11 w-11 rounded-xl bg-gradient-to-br from-amber-400/20 via-pink-500/20 to-red-500/20 ring-1 ring-amber-400/40 shadow-[0_0_18px_rgba(251,191,36,0.55)] hover:shadow-[0_0_26px_rgba(239,68,68,0.75)] transition-shadow"
              >
                <Menu className="h-7 w-7 text-amber-200 drop-shadow-[0_0_6px_rgba(251,191,36,0.9)]" strokeWidth={2.5} />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 border-r border-border bg-transparent">
              <AppSidebar role={role} onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <Link to={role === "admin" ? "/admin-income" : "/wallet"} aria-label="Wallet">
            <Button
              variant="ghost"
              size="icon"
              className="relative h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-400/20 via-cyan-500/20 to-indigo-500/20 ring-1 ring-emerald-400/40 shadow-[0_0_18px_rgba(16,185,129,0.55)] hover:shadow-[0_0_26px_rgba(6,182,212,0.75)] transition-shadow"
            >
              <Wallet className="h-6 w-6 text-emerald-200 drop-shadow-[0_0_6px_rgba(16,185,129,0.9)]" strokeWidth={2.5} />
              {role === "admin" && pendingWd > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-gradient-to-br from-amber-300 to-red-500 text-[10px] font-bold text-white shadow-[0_0_10px_rgba(239,68,68,0.9)]">
                  {pendingWd}
                </span>
              )}
            </Button>
          </Link>
          {role === "admin" && (
            <Link to="/hr-management" aria-label="HR Approvals">
              <Button
                variant="ghost"
                size="icon"
                className="relative h-11 w-11 rounded-xl bg-gradient-to-br from-fuchsia-400/20 via-violet-500/20 to-indigo-500/20 ring-1 ring-fuchsia-400/40 shadow-[0_0_18px_rgba(217,70,239,0.55)] hover:shadow-[0_0_26px_rgba(139,92,246,0.75)] transition-shadow"
              >
                <UserCheck className="h-6 w-6 text-fuchsia-200 drop-shadow-[0_0_6px_rgba(217,70,239,0.9)]" strokeWidth={2.5} />
                {pendingHr > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-gradient-to-br from-amber-300 to-red-500 text-[10px] font-bold text-white shadow-[0_0_10px_rgba(239,68,68,0.9)] animate-pulse">
                    {pendingHr}
                  </span>
                )}
              </Button>
            </Link>
          )}
          <div className="hidden sm:flex items-center gap-2">
            <Badge variant="outline" className="gap-1 border-white/10 bg-white/5">
              <Gift className="h-3 w-3" /> REF-YTC-4821
            </Badge>
            <Badge className="gap-1 gradient-accent text-white border-0">
              <Crown className="h-3 w-3" /> Premium
            </Badge>
          </div>
        </div>

        <div className="hidden md:flex items-center justify-center text-xs text-muted-foreground">
          {todayString()}
        </div>

        <div className="flex items-center gap-2 justify-end">
          <Popover open={notifOpen} onOpenChange={(o) => { setNotifOpen(o); if (o) markAllRead(); }}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Notifications"
                className="relative h-11 w-11 rounded-xl bg-gradient-to-br from-amber-400/20 via-pink-500/20 to-red-500/20 ring-1 ring-amber-400/40 shadow-[0_0_18px_rgba(251,191,36,0.55)] hover:shadow-[0_0_26px_rgba(239,68,68,0.75)] transition-shadow"
              >
                <Bell className="h-7 w-7 text-amber-200 drop-shadow-[0_0_6px_rgba(251,191,36,0.9)]" strokeWidth={2.5} />
                {unreadCount > 0 ? (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-gradient-to-br from-amber-300 to-red-500 text-[10px] font-bold text-white shadow-[0_0_10px_rgba(239,68,68,0.9)] animate-pulse">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                ) : (
                  <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-gradient-to-br from-amber-300 to-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)] opacity-60" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[340px] p-0 border border-fuchsia-400/30 bg-gradient-to-br from-slate-950/95 via-slate-900/95 to-fuchsia-950/40 backdrop-blur-xl shadow-[0_0_40px_-10px_rgba(217,70,239,0.6)]">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gradient-to-r from-amber-500/10 via-fuchsia-500/10 to-pink-500/10">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-amber-300" />
                  <span className="text-sm font-bold bg-gradient-to-r from-amber-200 to-fuchsia-300 bg-clip-text text-transparent uppercase tracking-wider">Announcements</span>
                </div>
                <Link to="/announcements" onClick={() => setNotifOpen(false)} className="text-[10px] text-fuchsia-300 hover:text-fuchsia-200 uppercase tracking-wider">View all</Link>
              </div>
              <div className="max-h-[380px] overflow-y-auto divide-y divide-white/5">
                {announcements.length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs text-white/50">No announcements yet</div>
                ) : (
                  announcements.map((a) => {
                    const t = new Date(a.published_at ?? a.created_at);
                    const isNew = t.getTime() > lastRead;
                    return (
                      <button
                        key={a.id}
                        onClick={() => { setNotifOpen(false); navigate({ to: "/announcements" }); }}
                        className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors group"
                      >
                        <div className="flex items-start gap-2">
                          {isNew && <span className="mt-1.5 h-2 w-2 rounded-full bg-gradient-to-br from-amber-300 to-red-500 shadow-[0_0_6px_rgba(239,68,68,0.9)] shrink-0" />}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-white truncate group-hover:text-amber-200 transition-colors">{a.title}</p>
                              {a.priority && a.priority !== "normal" && (
                                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-400/30">{a.priority}</span>
                              )}
                            </div>
                            {a.body && <p className="text-xs text-white/60 line-clamp-2 mt-0.5">{a.body}</p>}
                            <p className="text-[10px] text-white/40 mt-1">{t.toLocaleString()}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </PopoverContent>
          </Popover>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle theme"
            onClick={toggleTheme}
            className="relative h-11 w-11 rounded-xl bg-gradient-to-br from-indigo-400/20 via-violet-500/20 to-slate-500/20 ring-1 ring-indigo-400/40 shadow-[0_0_18px_rgba(129,140,248,0.55)] hover:shadow-[0_0_26px_rgba(167,139,250,0.75)] transition-shadow"
          >
            {dark ? (
              <Moon className="h-6 w-6 text-indigo-200 drop-shadow-[0_0_6px_rgba(129,140,248,0.9)] fill-indigo-200/30" strokeWidth={2.5} />
            ) : (
              <Sun className="h-6 w-6 text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.9)]" strokeWidth={2.5} />
            )}
          </Button>
          <Link to="/profile" aria-label="Profile">
            <Avatar className="h-9 w-9 ring-2 ring-primary/40 hover:ring-primary transition">
              {avatarUrl && (
                <AvatarImage
                  src={avatarUrl}
                  alt="User profile photo"
                  className="h-full w-full object-cover object-center"
                />
              )}
              <AvatarFallback className="gradient-primary text-white text-sm font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>
    </motion.header>
  );
}