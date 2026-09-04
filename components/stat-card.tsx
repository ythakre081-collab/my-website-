import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const GRADIENTS = [
  "from-fuchsia-500 to-purple-600",
  "from-indigo-500 to-blue-600",
  "from-sky-500 to-cyan-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-violet-500 to-indigo-600",
  "from-purple-500 to-blue-600",
  "from-pink-500 to-purple-600",
];

export function StatCard({
  label,
  value,
  icon: Icon,
  delta,
  index = 0,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  delta?: string;
  index?: number;
}) {
  const grad = GRADIENTS[index % GRADIENTS.length];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35 }}
      whileHover={{ y: -4 }}
      className="glass group relative overflow-hidden rounded-2xl p-5 transition-shadow hover:shadow-[0_20px_50px_-20px_oklch(0.55_0.22_285/0.55)]"
    >
      <div className={cn("pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-gradient-to-br opacity-20 blur-2xl transition-opacity group-hover:opacity-40", grad)} />
      <div className="flex items-start justify-between">
        <div className={cn("grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br text-white shadow-lg", grad)}>
          <Icon className="h-5 w-5" />
        </div>
        {delta && (
          <span className="text-[11px] font-medium text-emerald-400">{delta}</span>
        )}
      </div>
      <div className="mt-5 text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold tracking-tight">{value}</div>
    </motion.div>
  );
}