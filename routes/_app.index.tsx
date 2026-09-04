import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  IndianRupee,
  CalendarDays,
  CalendarRange,
  CalendarCheck,
  Infinity as InfinityIcon,
  Activity,
  Flame,
  BarChart3,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { PageShell } from "@/components/page-shell";
import { AnnouncementsBanner } from "@/components/announcements-banner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/")({
  component: Dashboard,
});

type Txn = { amount: number; type: string; user_id: string; created_at: string };
type DailyRow = { user_id: string; entry_date: string; amount: number };
type OverrideRow = { user_id: string; lifetime: number };
type RangeKey = "today" | "week" | "month" | "lifetime";

const inr = (n: number) =>
  "₹" + Math.round(n).toLocaleString("en-IN");

function useCountUp(target: number, duration = 900) {
  const to = Number(target) || 0;
  const [val, setVal] = useState(to);
  const prevRef = useRef(to);
  useEffect(() => {
    const from = prevRef.current;
    if (from === to) return;
    // Skip animation for tiny deltas to avoid perpetual re-renders on realtime tick
    if (Math.abs(to - from) < 1) {
      prevRef.current = to;
      setVal(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(from + (to - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else prevRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration]);
  return val;
}

function CountUp({ value, duration = 900, prefix = "" }: { value: number; duration?: number; prefix?: string }) {
  const v = useCountUp(value, duration);
  return <>{prefix}{Math.round(v).toLocaleString("en-IN")}</>;
}

function ZoomControls({ zoom, setZoom }: { zoom: number; setZoom: (n: number) => void }) {
  const clamp = (n: number) => Math.max(0.6, Math.min(1.6, Math.round(n * 100) / 100));
  return (
    <div className="hidden lg:flex fixed bottom-24 right-6 z-40 flex-col gap-1 rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur-xl p-1 shadow-[0_10px_30px_-10px_rgba(168,85,247,0.5)]">
      <button
        onClick={() => setZoom(clamp(zoom + 0.1))}
        className="grid h-9 w-9 place-items-center rounded-xl text-white/90 hover:bg-white/10 transition"
        aria-label="Zoom in"
        title="Zoom in"
      >
        <ZoomIn className="h-4 w-4" />
      </button>
      <div className="text-center text-[10px] font-semibold text-white/70 tabular-nums">
        {Math.round(zoom * 100)}%
      </div>
      <button
        onClick={() => setZoom(clamp(zoom - 0.1))}
        className="grid h-9 w-9 place-items-center rounded-xl text-white/90 hover:bg-white/10 transition"
        aria-label="Zoom out"
        title="Zoom out"
      >
        <ZoomOut className="h-4 w-4" />
      </button>
      <button
        onClick={() => setZoom(1)}
        className="grid h-9 w-9 place-items-center rounded-xl text-white/70 hover:bg-white/10 transition"
        aria-label="Reset zoom"
        title="Reset zoom"
      >
        <RotateCcw className="h-4 w-4" />
      </button>
    </div>
  );
}

function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function daysAgo(n: number) { const d = startOfToday(); d.setDate(d.getDate() - n); return d; }
function startOfMonth() { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; }

function Dashboard() {
  const { profile, role, user } = useAuth();
  const [txns, setTxns] = useState<Txn[]>([]);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [range, setRange] = useState<RangeKey>("week");
  const [zoom, setZoom] = useState<number>(() => {
    if (typeof window === "undefined") return 1;
    const s = Number(window.localStorage.getItem("dashboard-zoom"));
    return s >= 0.6 && s <= 1.6 ? s : 1;
  });
  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem("dashboard-zoom", String(zoom));
  }, [zoom]);

  useEffect(() => {
    let cancelled = false;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let inFlight = false;
    // Cap fetched history — cards use last month/week, chart max is 12mo.
    const historyStart = new Date();
    historyStart.setMonth(historyStart.getMonth() - 13);
    historyStart.setHours(0, 0, 0, 0);
    const historyStartISO = historyStart.toISOString();
    const historyStartDate = historyStartISO.slice(0, 10);

    async function load() {
      if (inFlight) return;
      inFlight = true;
      let tq = supabase
        .from("wallet_transactions")
        .select("amount,type,user_id,created_at")
        .neq("type", "withdraw")
        .gte("created_at", historyStartISO)
        .order("created_at", { ascending: true })
        .limit(5000);
      if (role !== "admin" && user) tq = tq.eq("user_id", user.id);
      const { data: t } = await tq;

      let dq = supabase
        .from("daily_income")
        .select("user_id,entry_date,amount")
        .gte("entry_date", historyStartDate)
        .limit(5000);
      if (role !== "admin" && user) dq = dq.eq("user_id", user.id);
      const { data: d } = await dq;

      let oq = supabase.from("income_overrides").select("user_id,lifetime");
      if (role !== "admin" && user) oq = oq.eq("user_id", user.id);
      const { data: o } = await oq;

      inFlight = false;
      if (cancelled) return;
      setTxns((t ?? []) as Txn[]);
      setDaily((d ?? []) as DailyRow[]);
      setOverrides((o ?? []) as OverrideRow[]);
    }
    function scheduleLoad() {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => { void load(); }, 1500);
    }
    load();
    const ch = supabase
      .channel("dashboard_income")
      .on("postgres_changes", { event: "*", schema: "public", table: "wallet_transactions" }, scheduleLoad)
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_income" }, scheduleLoad)
      .on("postgres_changes", { event: "*", schema: "public", table: "income_overrides" }, scheduleLoad)
      .subscribe();
    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(ch);
    };
  }, [role, user]);

  const totals = useMemo(() => {
    const t0 = startOfToday().getTime();
    const y0 = daysAgo(1).getTime();
    const w0 = daysAgo(7).getTime();
    const pw0 = daysAgo(14).getTime();
    const m0 = startOfMonth().getTime();
    const pm0 = new Date(startOfMonth()); pm0.setMonth(pm0.getMonth() - 1);
    const pmStart = pm0.getTime();
    const pmEnd = startOfMonth().getTime();

    let today = 0, yesterday = 0, week = 0, prevWeek = 0, month = 0, prevMonth = 0, lifetime = 0;
    for (const t of txns) {
      const ts = new Date(t.created_at).getTime();
      const a = Number(t.amount) || 0;
      lifetime += a;
      if (ts >= t0) today += a;
      else if (ts >= y0) yesterday += a;
      if (ts >= w0) week += a;
      else if (ts >= pw0) prevWeek += a;
      if (ts >= m0) month += a;
      else if (ts >= pmStart && ts < pmEnd) prevMonth += a;
    }
    for (const d of daily) {
      const ts = new Date(d.entry_date + "T00:00:00").getTime();
      const a = Number(d.amount) || 0;
      lifetime += a;
      if (ts >= t0) today += a;
      else if (ts >= y0 && ts < t0) yesterday += a;
      if (ts >= w0) week += a;
      else if (ts >= pw0 && ts < w0) prevWeek += a;
      if (ts >= m0) month += a;
      else if (ts >= pmStart && ts < pmEnd) prevMonth += a;
    }
    for (const o of overrides) {
      lifetime += Number(o.lifetime) || 0;
    }

    return {
      today,
      yesterday,
      week,
      prevWeek,
      month,
      prevMonth,
      lifetime,
    };
  }, [txns, daily, overrides]);

  const pct = (curr: number, prev: number) => {
    if (prev <= 0) return curr > 0 ? 100 : 0;
    return ((curr - prev) / prev) * 100;
  };

  const cards: Array<{ label: string; value: number; delta: number; icon: LucideIcon; sub: string }> = [
    { label: "Today Income", value: totals.today, delta: pct(totals.today, totals.yesterday), icon: CalendarCheck, sub: "vs yesterday" },
    { label: "Last 7 Days", value: totals.week, delta: pct(totals.week, totals.prevWeek), icon: CalendarDays, sub: "vs previous 7d" },
    { label: "This Month", value: totals.month, delta: pct(totals.month, totals.prevMonth), icon: CalendarRange, sub: "vs last month" },
    { label: "Lifetime", value: totals.lifetime, delta: 0, icon: InfinityIcon, sub: "all-time earnings" },
  ];

  const chartData = useMemo(() => {
    if (range === "today") {
      const buckets = Array.from({ length: 24 }, (_, h) => ({ label: `${h}h`, income: 0 }));
      const t0 = startOfToday().getTime();
      for (const t of txns) {
        const ts = new Date(t.created_at).getTime();
        if (ts < t0) continue;
        const h = new Date(t.created_at).getHours();
        buckets[h].income += Number(t.amount) || 0;
      }
      // daily_income for today lumped into current hour
      const todayStr = new Date().toISOString().slice(0, 10);
      const todayAmt = daily.filter((d) => d.entry_date === todayStr).reduce((s, d) => s + Number(d.amount || 0), 0);
      if (todayAmt > 0) buckets[new Date().getHours()].income += todayAmt;
      return buckets;
    }
    if (range === "week") {
      const buckets = Array.from({ length: 7 }, (_, i) => {
        const d = daysAgo(6 - i);
        return { label: d.toLocaleDateString("en-IN", { weekday: "short" }), key: d.getTime(), income: 0 };
      });
      for (const t of txns) {
        const d = new Date(t.created_at); d.setHours(0, 0, 0, 0);
        const b = buckets.find((x) => x.key === d.getTime());
        if (b) b.income += Number(t.amount) || 0;
      }
      for (const dr of daily) {
        const d = new Date(dr.entry_date + "T00:00:00"); d.setHours(0, 0, 0, 0);
        const b = buckets.find((x) => x.key === d.getTime());
        if (b) b.income += Number(dr.amount) || 0;
      }
      return buckets;
    }
    if (range === "month") {
      const days = 30;
      const buckets = Array.from({ length: days }, (_, i) => {
        const d = daysAgo(days - 1 - i);
        return { label: `${d.getDate()}`, key: d.getTime(), income: 0 };
      });
      for (const t of txns) {
        const d = new Date(t.created_at); d.setHours(0, 0, 0, 0);
        const b = buckets.find((x) => x.key === d.getTime());
        if (b) b.income += Number(t.amount) || 0;
      }
      for (const dr of daily) {
        const d = new Date(dr.entry_date + "T00:00:00"); d.setHours(0, 0, 0, 0);
        const b = buckets.find((x) => x.key === d.getTime());
        if (b) b.income += Number(dr.amount) || 0;
      }
      return buckets;
    }
    // lifetime — monthly buckets last 12 months
    const buckets = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0);
      d.setMonth(d.getMonth() - (11 - i));
      return { label: d.toLocaleDateString("en-IN", { month: "short" }), key: `${d.getFullYear()}-${d.getMonth()}`, income: 0 };
    });
    for (const t of txns) {
      const d = new Date(t.created_at);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const b = buckets.find((x) => x.key === key);
      if (b) b.income += Number(t.amount) || 0;
    }
    for (const dr of daily) {
      const d = new Date(dr.entry_date + "T00:00:00");
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const b = buckets.find((x) => x.key === key);
      if (b) b.income += Number(dr.amount) || 0;
    }
    return buckets;
  }, [txns, daily, range]);

  const hasChartData = useMemo(
    () => chartData.some((d: any) => Number(d.income) > 0),
    [chartData],
  );

  const chartStats = useMemo(() => {
    const vals = chartData.map((d: any) => Number(d.income) || 0);
    const total = vals.reduce((s, v) => s + v, 0);
    const peak = vals.reduce((m, v) => (v > m ? v : m), 0);
    const nonZero = vals.filter((v) => v > 0).length;
    const avg = nonZero > 0 ? total / nonZero : 0;
    return { total, peak, avg };
  }, [chartData]);

  const displayName = (profile?.full_name ?? (role === "admin" ? "Admin" : "there")).toUpperCase();

  return (
    <PageShell title="Dashboard" description={role === "admin" ? "Global earnings overview" : "Your earnings, live"}>
      <div style={{ zoom }}>
      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative overflow-hidden rounded-3xl p-[1.5px]"
      >
        {/* Animated conic gradient border */}
        <div className="absolute inset-0 rounded-3xl bg-[conic-gradient(from_0deg,#a855f7,#ec4899,#f59e0b,#22d3ee,#a855f7)] opacity-80 animate-[spin_18s_linear_infinite]" />
        <div className="relative rounded-[calc(1.5rem-1.5px)] p-6 sm:p-10 overflow-hidden bg-gradient-to-br from-[#1a0b3d]/95 via-[#0f172a]/90 to-[#2d1b5e]/95 backdrop-blur-xl">
        <div className="absolute -top-32 -right-24 h-80 w-80 rounded-full bg-fuchsia-500/40 blur-3xl animate-pulse" />
        <div className="absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-violet-500/30 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-pink-500/15 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.08] mix-blend-overlay"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, white 0.5px, transparent 0.5px), radial-gradient(circle at 80% 60%, white 0.5px, transparent 0.5px)",
            backgroundSize: "48px 48px, 64px 64px",
          }}
        />
        <div className="relative grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
          <div className="min-w-0">
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="inline-flex items-center gap-2 rounded-full border border-fuchsia-400/40 bg-gradient-to-r from-fuchsia-500/25 via-violet-500/20 to-pink-500/25 px-4 py-1.5 text-[11px] uppercase tracking-[0.2em] backdrop-blur shadow-[0_0_30px_-6px_rgba(217,70,239,0.7)]"
            >
              <Sparkles className="h-3.5 w-3.5 text-fuchsia-300 animate-pulse" />
              <span className="text-white/70">Welcome back</span>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mt-4 flex flex-wrap items-center gap-3"
            >
              <span className="relative inline-block font-black tracking-tight text-2xl sm:text-3xl leading-none">
                <span className="absolute inset-0 blur-[18px] text-white opacity-80" aria-hidden="true">{displayName}</span>
                <span className="absolute inset-0 blur-[4px] text-white opacity-90" aria-hidden="true">{displayName}</span>
                <span className="relative text-white drop-shadow-[0_2px_20px_rgba(255,255,255,0.9)]" style={{ WebkitTextStroke: "0.7px rgba(255,255,255,0.85)" }}>{displayName}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2.5 py-1 shadow-[0_0_18px_-4px_rgba(37,211,102,0.7)]">
                <svg viewBox="0 0 24 24" className="h-4 w-4 drop-shadow-[0_0_6px_rgba(37,211,102,0.7)]" aria-hidden="true">
                  <path fill="#25D366" d="M12 2.4c-.7 0-1.35.32-1.78.85l-.9 1.09a2.3 2.3 0 0 1-1.94.83l-1.4-.09a2.3 2.3 0 0 0-2.44 2.44l.09 1.4a2.3 2.3 0 0 1-.83 1.94l-1.09.9a2.3 2.3 0 0 0 0 3.56l1.09.9c.55.45.86 1.13.83 1.84l-.09 1.4a2.3 2.3 0 0 0 2.44 2.54l1.4-.09a2.3 2.3 0 0 1 1.94.83l.9 1.09a2.3 2.3 0 0 0 3.56 0l.9-1.09a2.3 2.3 0 0 1 1.94-.83l1.4.09a2.3 2.3 0 0 0 2.44-2.44l-.09-1.4a2.3 2.3 0 0 1 .83-1.94l1.09-.9a2.3 2.3 0 0 0 0-3.56l-1.09-.9a2.3 2.3 0 0 1-.83-1.94l.09-1.4a2.3 2.3 0 0 0-2.44-2.44l-1.4.09a2.3 2.3 0 0 1-1.94-.83l-.9-1.09A2.3 2.3 0 0 0 12 2.4Z"/>
                  <path fill="#fff" d="m10.6 15.4-2.7-2.7 1.2-1.2 1.5 1.5 4-4 1.2 1.2z"/>
                </svg>
                <span className="text-[11px] font-bold tracking-wider text-emerald-300 uppercase">Verified</span>
              </span>
            </motion.div>
            <h2 className="mt-5 text-4xl sm:text-6xl font-black tracking-tight leading-[1.05]">
              <span className="inline-block mr-2">💼</span>
              <span className="relative inline-block">
                <span className="relative z-10 bg-gradient-to-r from-amber-300 via-fuchsia-400 to-violet-400 bg-clip-text text-transparent drop-shadow-[0_2px_25px_rgba(217,70,239,0.6)]">
                  Zero Investment
                </span>
                <motion.span
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.4, duration: 0.6, ease: "easeOut" }}
                  className="absolute -bottom-1 left-0 right-0 h-[6px] origin-left rounded-full bg-gradient-to-r from-amber-400 via-fuchsia-500 to-violet-500 blur-[2px]"
                />
              </span>
              <span className="ml-3 text-white drop-shadow-[0_2px_20px_rgba(255,255,255,0.35)]">Work</span>
            </h2>
            <div className="mt-2 text-[11px] sm:text-xs font-semibold tracking-[0.25em] uppercase bg-gradient-to-r from-amber-300 via-fuchsia-400 to-violet-400 bg-clip-text text-transparent drop-shadow-[0_1px_10px_rgba(217,70,239,0.4)]">
              ytcommunity.online
            </div>
            <p className="mt-4 max-w-xl text-sm sm:text-base text-white/70">
              Start earning by opening Demat accounts.{" "}
              <span className="bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent font-bold">No investment required.</span>
            </p>
          </div>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, type: "spring", stiffness: 200, damping: 18 }}
            whileHover={{ scale: 1.03, y: -3 }}
            className="relative rounded-2xl min-w-[240px] border border-amber-400/40 shadow-[0_20px_50px_-15px_rgba(251,191,36,0.5)]"
          >
            <div className="relative rounded-2xl p-5 overflow-hidden bg-gradient-to-br from-[#1a0b3d]/95 via-[#0f172a]/95 to-[#2d1b0e]/95 backdrop-blur-xl">
              <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-amber-400/40 blur-2xl" />
              <div className="pointer-events-none absolute -left-8 -bottom-8 h-32 w-32 rounded-full bg-fuchsia-500/30 blur-2xl" />
              <div className="relative flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-amber-200/80 font-semibold">
                <Sparkles className="h-3 w-3 text-amber-300" /> Lifetime Earnings
              </div>
              <div className="relative mt-2 text-4xl sm:text-5xl font-black tracking-tight bg-gradient-to-r from-amber-300 via-yellow-200 to-orange-300 bg-clip-text text-transparent drop-shadow-[0_2px_20px_rgba(251,191,36,0.5)]">
                <CountUp value={totals.lifetime} duration={2000} prefix="₹" />
              </div>
              <div className="relative mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 px-2 py-0.5 text-[11px] font-bold text-emerald-300">
                <TrendingUp className="h-3 w-3" /> <CountUp value={totals.month} duration={2000} prefix="₹" /> this month
              </div>
            </div>
          </motion.div>
        </div>
        </div>
      </motion.section>

      <AnnouncementsBanner />

      {/* Income cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c, i) => {
          const Icon = c.icon;
          const up = c.delta >= 0;
          const themes = [
            { border: "from-amber-400 via-orange-500 to-rose-500", glow: "bg-amber-400/30", icon: "from-amber-400 to-orange-500", shadow: "shadow-[0_10px_30px_-10px_rgba(251,146,60,0.6)]", value: "from-amber-300 to-orange-300" },
            { border: "from-cyan-400 via-sky-500 to-blue-600", glow: "bg-sky-400/30", icon: "from-cyan-400 to-blue-500", shadow: "shadow-[0_10px_30px_-10px_rgba(56,189,248,0.6)]", value: "from-cyan-300 to-sky-300" },
            { border: "from-fuchsia-400 via-purple-500 to-indigo-600", glow: "bg-fuchsia-400/30", icon: "from-fuchsia-500 to-purple-600", shadow: "shadow-[0_10px_30px_-10px_rgba(217,70,239,0.6)]", value: "from-fuchsia-300 to-purple-300" },
            { border: "from-emerald-400 via-teal-500 to-cyan-600", glow: "bg-emerald-400/30", icon: "from-emerald-400 to-teal-500", shadow: "shadow-[0_10px_30px_-10px_rgba(16,185,129,0.6)]", value: "from-emerald-300 to-teal-300" },
          ];
          const t = themes[i % themes.length];
          return (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, duration: 0.35 }}
              whileHover={{ y: -5, scale: 1.02 }}
              className={cn("group relative overflow-hidden rounded-2xl p-[1.5px]", t.shadow)}
            >
              <div className={cn("absolute inset-0 rounded-2xl bg-gradient-to-br opacity-90", t.border)} />
              <div className={cn("absolute inset-0 rounded-2xl bg-gradient-to-br opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-70", t.border)} />
              <div className="relative rounded-[calc(1rem-1.5px)] bg-gradient-to-br from-background/95 via-background/90 to-background/95 backdrop-blur-xl p-5 overflow-hidden">
                <div className={cn("pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-2xl opacity-40 transition-opacity duration-500 group-hover:opacity-80", t.glow)} />
                <div className={cn("pointer-events-none absolute -left-10 -bottom-10 h-28 w-28 rounded-full blur-2xl opacity-20 transition-opacity duration-500 group-hover:opacity-50", t.glow)} />
                <div className="relative flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-white/70 font-semibold">{c.label}</div>
                  <div className={cn("mt-2 flex items-center gap-1 text-2xl sm:text-3xl font-black tracking-tight bg-gradient-to-r bg-clip-text text-transparent drop-shadow-[0_2px_10px_rgba(255,255,255,0.15)]", t.value)}>
                    <IndianRupee className="h-5 w-5 -mr-0.5" />
                    <span><CountUp value={c.value} duration={2000} /></span>
                  </div>
                  <div className={cn(
                    "mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    up ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300",
                  )}>
                    {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {c.label === "Lifetime" ? "All time" : `${up ? "+" : ""}${c.delta.toFixed(1)}%`}
                    <span className="text-muted-foreground font-normal">· {c.sub}</span>
                  </div>
                </div>
                <div className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-lg ring-1 ring-white/20", t.icon, t.shadow)}>
                  <Icon className="h-5 w-5" />
                </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Income graph */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="relative mt-6 overflow-hidden rounded-3xl p-[1.5px]"
      >
        {/* Animated gradient border */}
        <div className="absolute inset-0 rounded-3xl bg-[conic-gradient(from_120deg,#ef4444,#f59e0b,#fde047,#f97316,#ef4444)] opacity-80 animate-[spin_14s_linear_infinite]" />
        <div className="relative rounded-[calc(1.5rem-1.5px)] bg-gradient-to-br from-background/95 via-background/85 to-background/95 backdrop-blur-xl p-5 sm:p-7">
          <div className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-red-500/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-amber-400/25 blur-3xl" />

          {/* Header */}
          <div className="relative mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-red-500 via-orange-500 to-amber-400 text-white shadow-[0_15px_35px_-10px_rgba(251,146,60,0.7)]">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-black tracking-tight">Income Trend</h2>
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/50 bg-gradient-to-r from-red-500/25 to-amber-400/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-300">
                    <Sparkles className="h-3 w-3" /> Live
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Realtime earnings across your account</p>
              </div>
            </div>
            <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1 backdrop-blur">
              {(["today", "week", "month", "lifetime"] as RangeKey[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setRange(k)}
                  className={cn(
                    "relative rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors",
                    range === k ? "text-white" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {range === k && (
                    <motion.div layoutId="range-pill" className="absolute inset-0 rounded-lg bg-gradient-to-r from-red-500 via-orange-500 to-amber-400 shadow-[0_8px_24px_-8px_rgba(251,146,60,0.8)]" />
                  )}
                  <span className="relative">{k === "week" ? "7 Days" : k === "month" ? "Monthly" : k}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Stat chips */}
          <div className="relative mb-5 grid grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-2xl border border-red-500/30 bg-gradient-to-br from-red-500/15 to-red-500/5 p-3 backdrop-blur">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-red-200/80">
                <Activity className="h-3 w-3 text-red-400" /> Total
              </div>
              <div className="mt-1 text-lg sm:text-xl font-black bg-gradient-to-r from-red-400 to-orange-300 bg-clip-text text-transparent">{inr(chartStats.total)}</div>
            </div>
            <div className="rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-400/15 to-amber-400/5 p-3 backdrop-blur">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-amber-200/80">
                <Flame className="h-3 w-3 text-amber-400" /> Peak
              </div>
              <div className="mt-1 text-lg sm:text-xl font-black bg-gradient-to-r from-amber-300 to-yellow-200 bg-clip-text text-transparent">{inr(chartStats.peak)}</div>
            </div>
            <div className="rounded-2xl border border-yellow-400/30 bg-gradient-to-br from-yellow-300/15 to-yellow-300/5 p-3 backdrop-blur">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-yellow-200/80">
                <TrendingUp className="h-3 w-3 text-yellow-300" /> Avg
              </div>
              <div className="mt-1 text-lg sm:text-xl font-black bg-gradient-to-r from-yellow-200 to-amber-300 bg-clip-text text-transparent">{inr(chartStats.avg)}</div>
            </div>
          </div>

          {/* Chart */}
          <div className="relative h-64 sm:h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fde047" stopOpacity={0.85} />
                    <stop offset="45%" stopColor="#f97316" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="incomeBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="incomeStroke" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#ef4444" />
                    <stop offset="50%" stopColor="#f97316" />
                    <stop offset="100%" stopColor="#fde047" />
                  </linearGradient>
                  <filter id="incomeGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <CartesianGrid stroke="#fbbf24" strokeDasharray="4 6" opacity={0.12} vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={16}
                  dy={4}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  domain={[0, (max: number) => (max && max > 0 ? Math.ceil(max * 1.2) : 100)]}
                  tickFormatter={(v) => (v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
                />
                <Tooltip
                  cursor={{ stroke: "#f59e0b", strokeOpacity: 0.55, strokeWidth: 1.5, strokeDasharray: "4 4" }}
                  contentStyle={{
                    background: "rgba(20, 10, 6, 0.95)",
                    border: "1px solid rgba(251, 191, 36, 0.5)",
                    borderRadius: 14,
                    fontSize: 12,
                    padding: "10px 14px",
                    boxShadow: "0 20px 60px -20px rgba(239, 68, 68, 0.6)",
                    backdropFilter: "blur(12px)",
                  }}
                  labelStyle={{ color: "#fde047", marginBottom: 4, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 10 }}
                  itemStyle={{ color: "#fff7ed", fontWeight: 700 }}
                  formatter={(v: number, name: string) => [inr(v), name === "bar" ? "Volume" : "Income"]}
                />
                <Bar dataKey="income" name="bar" barSize={range === "month" ? 6 : 14} radius={[6, 6, 0, 0]} fill="url(#incomeBar)" isAnimationActive={false} />
                <Area
                  type="monotone"
                  dataKey="income"
                  stroke="url(#incomeStroke)"
                  strokeWidth={3.5}
                  fill="url(#incomeFill)"
                  filter="url(#incomeGlow)"
                  activeDot={{ r: 7, stroke: "#fde047", strokeWidth: 2, fill: "#ef4444" }}
                  dot={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
            {!hasChartData && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <div className="rounded-2xl border border-white/10 bg-background/60 px-5 py-3 text-center backdrop-blur-xl shadow-xl">
                  <div className="text-sm font-bold">No income in this range yet</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    Your earnings will light up this chart as they come in.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.section>
      </div>
      <ZoomControls zoom={zoom} setZoom={setZoom} />
    </PageShell>
  );
}