import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function PageShell({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8"
    >
      <div className="mb-6 flex flex-col gap-4 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="min-w-0">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-[1.05] bg-[linear-gradient(120deg,#f8fafc_0%,#c4b5fd_45%,#f0abfc_100%)] bg-clip-text text-transparent drop-shadow-[0_2px_18px_rgba(139,92,246,0.35)]">
            {title}
          </h1>
          {description && (
            <p className="mt-2 text-sm sm:text-base text-muted-foreground/90 max-w-2xl leading-relaxed">
              {description}
            </p>
          )}
        </div>
        {actions}
      </div>
      {children}
    </motion.div>
  );
}