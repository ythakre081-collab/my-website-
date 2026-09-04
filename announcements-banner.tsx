import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Megaphone, Pin, ChevronRight, Sparkles, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

type Priority = "low" | "normal" | "high" | "urgent";
type Announcement = {
  id: string;
  title: string;
  body: string;
  priority: Priority;
  pinned: boolean;
  published_at: string | null;
  created_at: string;
  created_by: string | null;
};

const RING: Record<Priority, string> = {
  low: "from-white/10 via-white/[0.04] to-transparent",
  normal: "from-primary/30 via-primary/10 to-transparent",
  high: "from-orange-500/40 via-orange-500/10 to-transparent",
  urgent: "from-red-500/50 via-red-500/15 to-transparent",
};

const CHIP: Record<Priority, string> = {
  low: "bg-white/10 text-muted-foreground border-white/10",
  normal: "bg-primary/15 text-primary border-primary/30",
  high: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  urgent: "bg-red-500/20 text-red-300 border-red-500/40 animate-pulse",
};

export function AnnouncementsBanner() {
  const { user } = useAuth();
  const [items, setItems] = useState<Announcement[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let alive = true;
    async function load() {
      const { data } = await supabase
        .from("announcements")
        .select("id,title,body,priority,pinned,published_at,created_at,created_by")
        .not("published_at", "is", null)
        .lte("published_at", new Date().toISOString())
        .order("pinned", { ascending: false })
        .order("published_at", { ascending: false })
        .limit(6);
      if (!alive) return;
      setItems(((data ?? []) as unknown) as Announcement[]);
    }
    load();
    const ch = supabase
      .channel("dashboard_announcements")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, (p) => {
        setItems((prev) => {
          if (p.eventType === "DELETE") return prev.filter((x) => x.id !== (p.old as { id: string }).id);
          const row = p.new as unknown as Announcement;
          if (!row.published_at || new Date(row.published_at) > new Date()) {
            return prev.filter((x) => x.id !== row.id);
          }
          if (p.eventType === "INSERT" && row.created_by !== user?.id) {
            toast(`📣 ${row.title}`, {
              description: row.body.slice(0, 100),
              duration: row.priority === "urgent" ? 10000 : 5000,
            });
          }
          const rest = prev.filter((x) => x.id !== row.id);
          const merged = [row, ...rest].slice(0, 6);
          merged.sort((a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
            return new Date(b.published_at ?? b.created_at).getTime() -
              new Date(a.published_at ?? a.created_at).getTime();
          });
          return merged;
        });
      })
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [user?.id]);

  useEffect(() => {
    if (items.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % items.length), 6000);
    return () => clearInterval(id);
  }, [items.length]);

  const current = useMemo(() => items[index] ?? items[0], [items, index]);
  if (!current) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative mt-6 overflow-hidden rounded-3xl border border-white/10 p-[1px]"
    >
      <div className={cn("absolute inset-0 rounded-3xl bg-gradient-to-br opacity-90", RING[current.priority])} />
      <div className="relative rounded-[calc(1.5rem-1px)] bg-gradient-to-br from-background/90 via-background/70 to-background/90 backdrop-blur-xl">
        <div className="pointer-events-none absolute -top-24 -right-16 h-56 w-56 rounded-full bg-primary/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-accent/20 blur-3xl" />

        <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:gap-6 sm:p-7">
          <div className="relative shrink-0">
            <div className="grid h-14 w-14 place-items-center rounded-2xl gradient-primary text-white shadow-[0_15px_35px_-10px_hsl(var(--primary)/0.7)]">
              {current.priority === "urgent" ? <AlertTriangle className="h-6 w-6" /> : <Megaphone className="h-6 w-6" />}
            </div>
            <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
              <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-primary" />
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
                <Sparkles className="h-3 w-3" />Live Update
              </span>
              <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest", CHIP[current.priority])}>
                {current.priority}
              </span>
              {current.pinned && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-amber-300">
                  <Pin className="h-3 w-3" />Pinned
                </span>
              )}
              <span className="text-[11px] text-muted-foreground">
                {formatDistanceToNow(new Date(current.published_at ?? current.created_at), { addSuffix: true })}
              </span>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={current.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3 }}
              >
                <h3 className="mt-2 text-xl sm:text-2xl font-black tracking-tight leading-tight">{current.title}</h3>
                <p className="mt-2 text-sm sm:text-[15px] leading-relaxed text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                  {current.body}
                </p>
              </motion.div>
            </AnimatePresence>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <Link
                to="/announcements"
                className="group inline-flex items-center gap-2 rounded-xl gradient-primary px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_-12px_hsl(var(--primary)/0.8)] transition-transform hover:-translate-y-0.5"
              >
                View all announcements
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              {items.length > 1 && (
                <div className="flex items-center gap-1.5">
                  {items.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setIndex(i)}
                      aria-label={`Show announcement ${i + 1}`}
                      className={cn(
                        "h-1.5 rounded-full transition-all",
                        i === index ? "w-6 bg-primary" : "w-1.5 bg-white/20 hover:bg-white/40",
                      )}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
