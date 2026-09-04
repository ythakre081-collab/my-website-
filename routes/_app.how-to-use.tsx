import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Link2,
  Wallet,
  Trophy,
  Gift,
  Headphones,
  Megaphone,
  Video,
  FileBarChart,
  User,
  Sparkles,
  PlayCircle,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";

export const Route = createFileRoute("/_app/how-to-use")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "How to Use Website | YT Community" },
      { name: "description", content: "Step-by-step guide to use the YT Community HR dashboard — refer links, wallet, leads, leaderboard and more." },
      { property: "og:title", content: "How to Use Website | YT Community" },
      { property: "og:description", content: "Learn how to use every feature of the YT Community dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HowToUsePage,
});

const STEPS: Array<{
  icon: typeof LayoutDashboard;
  title: string;
  desc: string;
  gradient: string;
  ring: string;
}> = [
  {
    icon: User,
    title: "1. Profile setup karo",
    desc: "Sabse pehle Profile me apna photo, mobile, city, UPI aur bank details bharo. Payment isi info par jayega.",
    gradient: "from-fuchsia-500/25 via-purple-500/15 to-transparent",
    ring: "ring-fuchsia-400/40",
  },
  {
    icon: Video,
    title: "2. Work Videos dekho",
    desc: "Kaam kaise karna hai ye seekhne ke liye Work Videos section me jao aur training videos dekho.",
    gradient: "from-amber-500/25 via-orange-500/15 to-transparent",
    ring: "ring-amber-400/40",
  },
  {
    icon: Link2,
    title: "3. Refer Links copy karo",
    desc: "Demat / Bank / Credit Card / App Legality section se apna refer link copy karke logo ko share karo.",
    gradient: "from-cyan-500/25 via-blue-500/15 to-transparent",
    ring: "ring-cyan-400/40",
  },
  {
    icon: PlayCircle,
    title: "4. Free & Paid Leads use karo",
    desc: "Free Leads section me diye gaye number ko copy karke call karo. Paid Leads me QR/UPI se payment karke premium leads le sakte ho.",
    gradient: "from-emerald-500/25 via-teal-500/15 to-transparent",
    ring: "ring-emerald-400/40",
  },
  {
    icon: FileBarChart,
    title: "5. Reports check karo",
    desc: "Reports section me admin dwara bheji gayi broker report aur account status dekh sakte ho.",
    gradient: "from-indigo-500/25 via-violet-500/15 to-transparent",
    ring: "ring-indigo-400/40",
  },
  {
    icon: LayoutDashboard,
    title: "6. Dashboard par income dekho",
    desc: "Jo income aapka hoga vo aapke Dashboard par live show hoga — Today, 7 Days, Month aur Lifetime sab kuch turant update hota rahega.",
    gradient: "from-rose-500/25 via-pink-500/15 to-transparent",
    ring: "ring-rose-400/40",
  },
  {
    icon: Wallet,
    title: "7. Wallet se withdrawal karo",
    desc: "Wallet & Payments me ‘Withdraw’ button dabao. Admin approve karte hi 24 hours ke andar aapke UPI/Bank par payment aa jayega.",
    gradient: "from-lime-500/25 via-green-500/15 to-transparent",
    ring: "ring-lime-400/40",
  },
  {
    icon: Trophy,
    title: "8. Leaderboard me rank badhao",
    desc: "Jitni zyada income, utni upar rank. Top performers ko special rewards milte hai.",
    gradient: "from-yellow-500/25 via-amber-500/15 to-transparent",
    ring: "ring-yellow-400/40",
  },
  {
    icon: Gift,
    title: "9. Special Offers dekho",
    desc: "Special Offers section me time-to-time chalti hui offers aur poster download kar sakte ho.",
    gradient: "from-pink-500/25 via-fuchsia-500/15 to-transparent",
    ring: "ring-pink-400/40",
  },
  {
    icon: Sparkles,
    title: "10. Status Marketing use karo",
    desc: "WhatsApp status aur reels ke liye ready-made premium posters yahan se download karo.",
    gradient: "from-violet-500/25 via-purple-500/15 to-transparent",
    ring: "ring-violet-400/40",
  },
  {
    icon: Megaphone,
    title: "11. Announcements par nazar rakho",
    desc: "Bell icon par sari nayi announcements aur notifications dikhengi — kabhi miss mat karna.",
    gradient: "from-orange-500/25 via-red-500/15 to-transparent",
    ring: "ring-orange-400/40",
  },
  {
    icon: Headphones,
    title: "12. Customer Support",
    desc: "Koi bhi problem ho to Customer Support me ticket banao — admin ko turant notification chali jayegi.",
    gradient: "from-sky-500/25 via-cyan-500/15 to-transparent",
    ring: "ring-sky-400/40",
  },
];

function HowToUsePage() {
  return (
    <PageShell
      title="How to Use Website"
      description="Step-by-step guide — har feature ka use hindi me samjho aur turant kaam shuru karo."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.35 }}
              className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${s.gradient} p-[1px] shadow-[0_10px_40px_-15px_rgba(139,92,246,0.4)]`}
            >
              <div className="relative rounded-2xl bg-[#0b0716]/85 backdrop-blur-xl p-5 h-full">
                <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 ring-1 ${s.ring} shadow-inner`}>
                  <Icon className="h-5 w-5 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
                </div>
                <h3 className="mt-4 text-base font-bold text-white leading-snug">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm text-white/70 leading-relaxed">
                  {s.desc}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-8 rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent p-5">
        <p className="text-sm sm:text-base text-emerald-200/90 leading-relaxed">
          <span className="font-bold text-emerald-300">Tip:</span> Koi bhi option samajh na aaye to Customer Support par message karo — admin turant reply karega.
        </p>
      </div>
    </PageShell>
  );
}