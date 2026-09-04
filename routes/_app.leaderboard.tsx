import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Medal, Trophy, Pencil, Loader2, ChevronLeft, ChevronRight, Pause, Play, Star } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { logActivity } from "@/lib/activity-log";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/leaderboard")({ component: LeaderboardPage });

type Row = {
  id: string;
  name: string;
  subtitle: string | null;
  avatar_url: string | null;
  points: number;
  bonus: number;
};

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const rankIcon = [Crown, Trophy, Medal];
const rankLabel = (i: number) =>
  i === 0 ? "CHAMPION" : i === 1 ? "RUNNER-UP" : i === 2 ? "SECOND RUNNER-UP" : `RANK #${i + 1}`;
const rankBadgeClass = (i: number) =>
  i === 0
    ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white"
    : i === 1
      ? "bg-gradient-to-br from-slate-300 to-slate-500 text-slate-900"
      : i === 2
        ? "bg-gradient-to-br from-orange-400 to-rose-500 text-white"
        : "bg-white/10 text-muted-foreground";

const cardThemes = [
  { card: "from-amber-400 via-orange-500 to-red-500", glowA: "bg-amber-400/40", glowB: "bg-orange-500/40", ring: "ring-amber-200/60" },
  { card: "from-slate-300 via-slate-400 to-slate-600", glowA: "bg-slate-200/40", glowB: "bg-slate-400/40", ring: "ring-white/60" },
  { card: "from-orange-500 via-rose-500 to-pink-600", glowA: "bg-rose-400/40", glowB: "bg-pink-500/40", ring: "ring-rose-200/60" },
  { card: "from-violet-500 via-fuchsia-500 to-pink-500", glowA: "bg-fuchsia-400/40", glowB: "bg-violet-500/40", ring: "ring-fuchsia-200/60" },
  { card: "from-emerald-400 via-teal-500 to-cyan-600", glowA: "bg-emerald-400/40", glowB: "bg-cyan-500/40", ring: "ring-emerald-200/60" },
  { card: "from-sky-500 via-blue-600 to-indigo-700", glowA: "bg-sky-400/40", glowB: "bg-indigo-500/40", ring: "ring-sky-200/60" },
];

function useSignedAvatar(path: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!path) { setUrl(null); return; }
    if (/^https?:\/\//i.test(path) || path.startsWith("data:")) { setUrl(path); return; }
    supabase.storage.from("avatars").createSignedUrl(path, 60 * 60).then(({ data }) => {
      if (!cancelled) setUrl(data?.signedUrl ?? null);
    });
    return () => { cancelled = true; };
  }, [path]);
  return url;
}

function EntryAvatar({ path, name, className }: { path: string | null; name: string; className?: string }) {
  const url = useSignedAvatar(path);
  const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <Avatar className={className}>
      {url && <AvatarImage src={url} alt={name} />}
      <AvatarFallback className="gradient-primary text-white text-xs">{initials}</AvatarFallback>
    </Avatar>
  );
}

function LeaderboardPage() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  // Admin bonus editor (upserts income_overrides.lifetime for that HR)
  const [editing, setEditing] = useState<Row | null>(null);
  const [bonusInput, setBonusInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data, error } = await (supabase as any).rpc("get_leaderboard");
      if (cancelled) return;
      if (error) {
        console.error("get_leaderboard", error);
      }
      const list: Row[] = ((data ?? []) as any[]).map((r) => ({
        id: r.id,
        name: r.full_name,
        subtitle: r.hr_code,
        avatar_url: r.avatar_url,
        points: Number(r.points) || 0,
        bonus: Number(r.bonus) || 0,
      }));
      setRows(list);
      setLoading(false);
    };
    load();
    const ch = supabase.channel("leaderboard_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_income" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "wallet_transactions" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "income_overrides" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "hr_profiles" }, load)
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, []);

  const visible = isAdmin ? rows : rows.slice(0, 10);
  const featured = rows.slice(0, 6);

  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => { if (slide >= featured.length) setSlide(0); }, [featured.length, slide]);
  useEffect(() => {
    if (paused || featured.length <= 1) return;
    const id = setInterval(() => setSlide((s) => (s + 1) % featured.length), 4500);
    return () => clearInterval(id);
  }, [paused, featured.length]);
  const active = featured[slide];
  const monthLabel = new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  const openEdit = (r: Row) => {
    setEditing(r);
    setBonusInput(String(r.bonus || 0));
  };

  const saveBonus = async () => {
    if (!editing) return;
    const val = Number(bonusInput);
    if (!Number.isFinite(val)) { toast.error("Enter a valid number"); return; }
    setSaving(true);
    const { error } = await supabase
      .from("income_overrides")
      .upsert({ user_id: editing.id, lifetime: val } as any, { onConflict: "user_id" });
    setSaving(false);
    if (error) return toast.error(error.message);
    await logActivity({ action: "leaderboard_bonus", entity_type: "income_overrides", entity_id: editing.id, metadata: { lifetime: val } });
    toast.success("Bonus updated — leaderboard recalculated");
    setEditing(null);
  };

  return (
    <PageShell
      title="Hall of Champions"
      description={isAdmin ? "Auto-ranked by lifetime income · Admin can adjust bonus" : `Top ${Math.min(10, rows.length)} performers`}
    >
      {loading ? (
        <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : rows.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
          <Trophy className="mx-auto mb-2 h-8 w-8 opacity-40" />No HRs to rank yet.
        </div>
      ) : (
        <>
          {featured.length > 0 && active && (
            <div className="mb-8">
              <div className="mb-5 flex items-center justify-center gap-3">
                <div className="h-px w-12 bg-gradient-to-r from-transparent to-amber-400/60" />
                <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                <div className="h-px w-12 bg-gradient-to-l from-transparent to-amber-400/60" />
              </div>
              <h2 className="text-center text-4xl sm:text-5xl font-black tracking-tight bg-gradient-to-r from-amber-400 via-orange-400 to-pink-500 bg-clip-text text-transparent">
                Hall of Champions
              </h2>
              <p className="mt-2 text-center text-sm text-muted-foreground">Auto-ranked by total income · updates live</p>

              <div className="relative mt-6 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-950/60 via-slate-950/60 to-purple-950/60 p-4 sm:p-6 backdrop-blur-xl">
                <motion.div key={`glowA-${slide}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}
                  className={cn("pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full blur-3xl", cardThemes[slide % cardThemes.length].glowA)} />
                <motion.div key={`glowB-${slide}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}
                  className={cn("pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full blur-3xl", cardThemes[slide % cardThemes.length].glowB)} />
                <div className="relative text-center text-sm font-semibold text-muted-foreground">{monthLabel}</div>

                <div className="relative mt-4 flex items-center gap-2">
                  <Button size="icon" variant="ghost" className="h-10 w-10 shrink-0 rounded-full border border-white/10 bg-white/5 backdrop-blur hover:bg-white/10"
                    onClick={() => setSlide((s) => (s - 1 + featured.length) % featured.length)}>
                    <ChevronLeft className="h-5 w-5" />
                  </Button>

                  <div className="relative flex-1">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={active.id}
                        initial={{ opacity: 0, x: 60 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -60 }}
                        transition={{ duration: 0.5, ease: "easeInOut" }}
                        className={cn(
                          "relative overflow-hidden rounded-2xl border border-white/25 bg-gradient-to-br p-6 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] backdrop-blur-xl",
                          cardThemes[slide % cardThemes.length].card,
                        )}
                      >
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-white/20 via-transparent to-transparent" />
                        <div className="absolute right-4 top-4 text-white/70">
                          <Crown className="h-6 w-6" />
                        </div>
                        <div className="relative inline-flex items-center gap-2 rounded-full bg-black/30 px-3 py-1 text-[11px] font-bold tracking-widest text-white ring-1 ring-white/30 backdrop-blur">
                          <span>#{slide + 1}</span>
                          <span>•</span>
                          <span>{rankLabel(slide)}</span>
                        </div>
                        <div className="relative mt-4 flex items-center gap-4">
                          <EntryAvatar path={active.avatar_url} name={active.name} className={cn("h-16 w-16 ring-2", cardThemes[slide % cardThemes.length].ring)} />
                          <div className="min-w-0">
                            <div className="truncate text-2xl sm:text-3xl font-black tracking-tight text-white">{active.name}</div>
                            {active.subtitle && <div className="mt-1 text-xs font-semibold text-white/90">{active.subtitle}</div>}
                          </div>
                        </div>
                        <div className="relative mt-6 space-y-3 text-sm">
                          <div className="flex items-center justify-between border-b border-white/20 pb-3">
                            <span className="text-white/80">Total Earning</span>
                            <span className="text-lg font-black text-white">{inr(active.points)}</span>
                          </div>
                          <div className="flex items-center justify-between border-b border-white/20 pb-3">
                            <span className="text-white/80">Bonus</span>
                            <span className="text-lg font-black text-white">{inr(active.bonus)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-white/80">Performer</span>
                            <span className="font-bold text-white">{active.name}</span>
                          </div>
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  <Button size="icon" variant="ghost" className="h-10 w-10 shrink-0 rounded-full border border-white/10 bg-white/5 backdrop-blur hover:bg-white/10"
                    onClick={() => setSlide((s) => (s + 1) % featured.length)}>
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>

                <div className="relative mt-5 flex items-center justify-center gap-3">
                  <Button size="icon" variant="ghost" className="h-9 w-9 rounded-full border border-white/10 bg-white/5 hover:bg-white/10"
                    onClick={() => setPaused((p) => !p)}>
                    {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  </Button>
                  <div className="flex items-center gap-1.5">
                    {featured.map((_, i) => (
                      <button key={i} onClick={() => setSlide(i)}
                        className={cn(
                          "h-1.5 rounded-full transition-all",
                          i === slide ? "w-6 bg-white" : "w-1.5 bg-white/30 hover:bg-white/50",
                        )}
                        aria-label={`Go to slide ${i + 1}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="glass rounded-2xl p-2 sm:p-3">
            <div className="flex items-center justify-between px-3 pt-2 pb-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                  {isAdmin ? "Full Ranking (Admin View)" : "Top 10 Performers"}
                </div>
                <div className="mt-0.5 text-base font-bold">
                  {visible.length} · {monthLabel}
                </div>
              </div>
              <Badge variant="outline" className="border-white/10 bg-white/5 text-[10px] tracking-widest">AUTO-RANKED</Badge>
            </div>
            <div className="divide-y divide-white/5">
              {visible.map((p, i) => {
                const Icon = rankIcon[i] ?? Trophy;
                return (
                  <motion.div key={p.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                    className="grid grid-cols-[auto_auto_1fr_auto_auto] items-center gap-3 sm:gap-4 rounded-xl px-3 py-3 hover:bg-white/[0.03]">
                    <div className={cn("grid h-10 w-10 place-items-center rounded-full text-xs font-black shadow-md", rankBadgeClass(i))}>
                      {i < 3 ? <Icon className="h-4 w-4" /> : `#${i + 1}`}
                    </div>
                    <EntryAvatar path={p.avatar_url} name={p.name} className="h-9 w-9" />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {p.subtitle ?? "—"}
                        {isAdmin && p.bonus > 0 && <span className="ml-2 text-amber-300">+ {inr(p.bonus)} bonus</span>}
                      </div>
                    </div>
                    <div className="text-right text-sm font-black text-sky-300">{inr(p.points)}</div>
                    {isAdmin ? (
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(p)} title="Adjust bonus">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    ) : <span />}
                  </motion.div>
                );
              })}
            </div>
          </div>
        </>
      )}

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="glass-strong max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust Leaderboard Bonus</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid gap-3">
              <div className="text-sm text-muted-foreground">
                <div className="font-medium text-foreground">{editing.name}</div>
                <div className="text-xs">Current total: {inr(editing.points)}</div>
              </div>
              <div>
                <Label>Bonus (₹) — added to lifetime score</Label>
                <Input
                  type="number"
                  value={bonusInput}
                  onChange={(e) => setBonusInput(e.target.value)}
                  placeholder="0"
                />
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Manual income is added automatically. Use this only for extra bonus adjustments.
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveBonus} disabled={saving} className="gradient-primary text-white">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
