import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/hooks/use-auth";
import { useBrandLogo } from "@/hooks/use-brand-logo";

// Rotating premium gradients per nav item — visible & vibrant
const ITEM_GRADIENTS = [
  "from-fuchsia-500 to-purple-600",
  "from-amber-400 to-orange-500",
  "from-cyan-400 to-blue-600",
  "from-emerald-400 to-teal-500",
  "from-rose-400 to-pink-600",
  "from-violet-400 to-indigo-600",
  "from-yellow-400 to-amber-600",
  "from-sky-400 to-cyan-600",
];

export function AppSidebar({
  onNavigate,
  role,
}: {
  onNavigate?: () => void;
  role?: AppRole | null;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = NAV_ITEMS.filter((i) => !i.roles || (role && i.roles.includes(role)));
  const logoUrl = useBrandLogo();

  return (
    <aside className="relative flex h-full w-72 flex-col overflow-hidden bg-gradient-to-b from-[#0f0a1f] via-[#0a0618] to-[#12081f] border-r border-white/10">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -top-20 -left-20 h-64 w-64 rounded-full bg-fuchsia-500/20 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -right-20 h-64 w-64 rounded-full bg-violet-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-amber-400/15 blur-3xl" />

      <div className="relative flex items-center gap-3 px-6 py-6 border-b border-white/10">
        <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-fuchsia-500/20 via-violet-500/20 to-indigo-600/20 ring-1 ring-white/20 shadow-[0_10px_30px_-8px_rgba(217,70,239,0.6)]">
          <img
            src={logoUrl}
            alt="YT Community Online Earn"
            className="h-full w-full object-contain"
            loading="eager"
          />
        </div>
        <div className="min-w-0">
          <div className="text-base font-black tracking-tight text-white drop-shadow-[0_2px_10px_rgba(255,255,255,0.25)]">YT COMMUNITY ONLINE EARN</div>
          <div className="text-[11px] uppercase tracking-widest text-fuchsia-300 font-bold">Creator OS</div>
        </div>
      </div>

      <nav className="relative flex-1 overflow-y-auto px-3 py-4 space-y-1.5">
        {items.map((item, i) => {
          const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          const Icon = item.icon;
          const grad = ITEM_GRADIENTS[i % ITEM_GRADIENTS.length];
          return (
            <motion.div
              key={item.to}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.02, duration: 0.25 }}
            >
              <Link
                to={item.to}
                onClick={onNavigate}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all",
                  active
                    ? "text-white shadow-[0_10px_30px_-10px_rgba(168,85,247,0.7)]"
                    : "text-white/80 hover:text-white hover:bg-white/5 hover:translate-x-0.5",
                  item.danger && !active && "text-rose-300/90 hover:text-rose-200 hover:bg-rose-500/10",
                )}
              >
                {active && (
                  <motion.div
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-fuchsia-500 via-violet-500 to-indigo-600 opacity-95 -z-10 ring-1 ring-white/30"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span
                  className={cn(
                    "grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-all",
                    active
                      ? "bg-white/20 ring-1 ring-white/30"
                      : cn("bg-gradient-to-br text-white ring-1 ring-white/10 opacity-90 group-hover:opacity-100 group-hover:scale-110", grad),
                  )}
                >
                  <Icon className="h-4 w-4 text-white drop-shadow" />
                </span>
                <span className="truncate tracking-tight">{item.title}</span>
              </Link>
            </motion.div>
          );
        })}
      </nav>
    </aside>
  );
}