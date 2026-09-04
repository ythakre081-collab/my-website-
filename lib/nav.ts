import {
  LayoutDashboard,
  Megaphone,
  Trophy,
  CalendarDays,
  CalendarClock,
  FolderOpen,
  Clock,
  History,
  UserCheck,
  Wallet,
  FileBarChart,
  Settings,
  MessageCircle,
  LogOut,
  Users,
  Upload,
  ScrollText,
  Activity,
  Video,
  Link2,
  Landmark,
  CreditCard,
  Gift,
  Headphones,
  Coins,
  User,
  Scale,
  Sparkles,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  to: string;
  icon: LucideIcon;
  danger?: boolean;
  roles?: Array<"admin" | "hr">;
};

export const NAV_ITEMS: NavItem[] = [
  // Primary menu (spec order — visible to both HR and Admin)
  { title: "Dashboard", to: "/", icon: LayoutDashboard },
  { title: "Profile", to: "/profile", icon: User },
  { title: "Work Videos", to: "/work-videos", icon: Video },
  { title: "Demat Account Refer Link", to: "/important-links", icon: Link2 },
  { title: "Bank Account Refer", to: "/bank-account-refer", icon: Landmark },
  { title: "Credit Card Refer", to: "/credit-card-refer", icon: CreditCard },
  { title: "Refer App Legality", to: "/broker-legality", icon: Scale },
  { title: "Reports", to: "/reports-hr", icon: FileBarChart, roles: ["hr"] },
  { title: "Reports", to: "/reports", icon: FileBarChart, roles: ["admin"] },
  { title: "Free Leads", to: "/leads-today", icon: CalendarDays },
  { title: "Paid Leads", to: "/paid-leads", icon: CalendarClock },
  { title: "Special Offers", to: "/rewards", icon: Gift },
  { title: "Leaderboard", to: "/leaderboard", icon: Trophy },
  { title: "Status Marketing", to: "/status-marketing", icon: Sparkles },
  { title: "Legal Documents", to: "/legal-documents", icon: Scale },
  { title: "Customer Support", to: "/support", icon: Headphones },
  { title: "Wallet & Payments", to: "/wallet", icon: Wallet },
  // Admin-only tools (below the primary menu)
  { title: "HR Management", to: "/hr-management", icon: Users, roles: ["admin"] },
  { title: "Manual Income", to: "/admin-income", icon: Coins, roles: ["admin"] },
  { title: "Bulk Upload", to: "/upload-leads", icon: Upload, roles: ["admin"] },
  { title: "Announcements", to: "/announcements", icon: Megaphone, roles: ["admin", "hr"] },
  { title: "WhatsApp", to: "/whatsapp", icon: MessageCircle, roles: ["admin"] },
  { title: "Activity Logs", to: "/activity-logs", icon: ScrollText, roles: ["admin"] },
  { title: "Settings", to: "/settings", icon: Settings, roles: ["admin"] },
  { title: "How to Use Website", to: "/how-to-use", icon: HelpCircle },
  { title: "Logout", to: "/logout", icon: LogOut, danger: true },
];