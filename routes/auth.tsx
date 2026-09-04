import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Eye, EyeOff, Mail, Lock, User as UserIcon, Phone, MapPin, ChevronDown, ArrowLeft } from "lucide-react";
import { useBrandLogo } from "@/hooks/use-brand-logo";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — YT COMMUNITY ONLINE EARN" },
      { name: "description", content: "Premium HR CRM • Manage Leads • Earn Daily." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "register" | "forgot">("signin");
  const logoUrl = useBrandLogo();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(220,38,38,0.18),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[300px] bg-[radial-gradient(ellipse_at_bottom,rgba(239,68,68,0.35),transparent_70%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 py-6">
        {mode === "signin" && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-6 flex flex-col items-center text-center"
          >
            <div className="relative">
              <div aria-hidden className="absolute inset-0 -z-10 rounded-[32px] bg-red-500/40 blur-3xl" />
              <div className="grid h-28 w-28 place-items-center rounded-[28px] bg-white shadow-[0_10px_40px_-5px_rgba(239,68,68,0.7)] overflow-hidden">
                <img src={logoUrl} alt="YT Community Online Earn logo" className="h-[85%] w-[85%] object-contain" />
              </div>
            </div>
            <h1 className="mt-6 text-3xl font-extrabold tracking-tight sm:text-4xl leading-tight">
              <span className="text-white">YT </span>
              <span className="bg-gradient-to-r from-amber-300 via-orange-400 to-red-500 bg-clip-text text-transparent">COMMUNITY</span>
              <br />
              <span className="bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">ONLINE EARN</span>
            </h1>
            <p className="mt-4 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.28em] text-amber-300/90">
              Premium HR CRM · Manage Leads · Earn Daily
            </p>
          </motion.div>
        )}

        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="relative w-full rounded-[28px] p-[1px] overflow-hidden"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[28px]"
            style={{
              background:
                "linear-gradient(150deg, rgba(251,191,36,0.65), rgba(239,68,68,0.35) 40%, rgba(0,0,0,0) 55%, rgba(239,68,68,0.4) 85%, rgba(251,191,36,0.6))",
            }}
          />
          <div className="relative rounded-[27px] bg-gradient-to-b from-[#1a0908] via-[#120504] to-[#080302] p-6 sm:p-8">
            {mode === "signin" && (
              <SignInForm
                onSwitch={() => setMode("register")}
                onForgot={() => setMode("forgot")}
              />
            )}
            {mode === "register" && <RegisterForm onSwitch={() => setMode("signin")} />}
            {mode === "forgot" && <ForgotForm onBack={() => setMode("signin")} />}
          </div>
        </motion.div>

        <p className="mt-6 text-center text-[11px] uppercase tracking-widest text-muted-foreground/70">
          Powered by YT COMMUNITY ONLINE EARN
        </p>
      </div>
    </div>
  );
}

function SignInForm({ onSwitch, onForgot }: { onSwitch: () => void; onForgot: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Signed in");
    navigate({ to: "/", replace: true });
  }

  return (
    <>
      <h2 className="text-xl font-semibold">Welcome back</h2>
      <p className="mt-1 text-sm text-muted-foreground">Sign in to your HR dashboard</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <FieldIcon icon={Mail} label="Gmail address">
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@gmail.com"
            className="pl-10 h-12 rounded-xl glass border-white/10"
          />
        </FieldIcon>

        <FieldIcon icon={Lock} label="Password">
          <Input
            type={show ? "text" : "password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="pl-10 pr-10 h-12 rounded-xl glass border-white/10"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </FieldIcon>

        <div className="flex justify-end">
          <button type="button" onClick={onForgot} className="text-xs font-semibold bg-gradient-to-r from-amber-300 to-red-500 bg-clip-text text-transparent">
            Forgot password?
          </button>
        </div>

        <div className="relative pt-1">
          <div aria-hidden className="pointer-events-none absolute inset-x-6 -bottom-2 h-8 rounded-full bg-red-500/60 blur-2xl" />
          <Button
          disabled={loading}
          className="relative w-full h-14 rounded-full bg-[linear-gradient(90deg,#7f1d1d_0%,#dc2626_45%,#ef4444_100%)] hover:opacity-95 text-white border-0 font-bold text-base tracking-wide shadow-[0_15px_45px_-8px_rgba(239,68,68,0.75)]"
          type="submit"
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Login
          </Button>
        </div>
      </form>

      <div className="mt-6 text-center text-sm text-muted-foreground">
        Don't have an account?{" "}
        <button onClick={onSwitch} className="font-semibold bg-gradient-to-r from-amber-300 to-red-500 bg-clip-text text-transparent">
          Register Now
        </button>
      </div>
    </>
  );
}

function RegisterForm({ onSwitch }: { onSwitch: () => void }) {
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    mobile: "",
    password: "",
    confirm: "",
    city: "",
    gender: "Male",
  });
  const [agree, setAgree] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agree) return toast.error("Please accept Terms & Conditions");
    if (form.password.length < 8) return toast.error("Password must be at least 8 characters");
    if (form.password !== form.confirm) return toast.error("Passwords do not match");
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          full_name: form.full_name,
          mobile: form.mobile,
          city: form.city,
          gender: form.gender,
        },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Registered! Awaiting admin approval.");
    navigate({ to: "/pending", replace: true });
  }

  return (
    <>
      <div className="flex items-start gap-4">
        <button
          type="button"
          onClick={onSwitch}
          aria-label="Back"
          className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full border border-amber-500/50 text-amber-400 hover:bg-amber-500/10 transition"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <h2 className="text-4xl font-extrabold tracking-tight text-white leading-none">
            Create account
          </h2>
          <p className="mt-2 text-sm text-amber-200/80">Join the YT Community Online Earn team</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <FieldIcon icon={UserIcon} label="Full Name">
          <Input required value={form.full_name} onChange={(e) => set("full_name", e.target.value)} className="pl-11 h-14 rounded-2xl bg-black/40 border-white/10 text-base placeholder:text-muted-foreground/60" placeholder="Your full name" />
        </FieldIcon>
        <FieldIcon icon={Mail} label="Email Address">
          <Input type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} className="pl-11 h-14 rounded-2xl bg-black/40 border-white/10 text-base placeholder:text-muted-foreground/60" placeholder="you@gmail.com" />
        </FieldIcon>
        <FieldIcon icon={Phone} label="Mobile Number">
          <Input required value={form.mobile} onChange={(e) => set("mobile", e.target.value)} className="pl-11 h-14 rounded-2xl bg-black/40 border-white/10 text-base placeholder:text-muted-foreground/60" placeholder="+91 98xxxxxxxx" />
        </FieldIcon>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium text-white">City</Label>
            <div className="relative mt-2">
              <Input required value={form.city} onChange={(e) => set("city", e.target.value)} className="h-14 rounded-2xl bg-black/40 border-white/10 text-base pl-4" placeholder="Indore" />
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium text-white">Gender</Label>
            <div className="relative mt-2">
              <select
                value={form.gender}
                onChange={(e) => set("gender", e.target.value)}
                className="w-full h-14 rounded-2xl border border-white/10 bg-black/40 pl-4 pr-10 text-base appearance-none focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
        </div>

        <FieldIcon icon={Lock} label="Password">
          <Input
            type={showPw ? "text" : "password"}
            required
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
            className="pl-11 pr-11 h-14 rounded-2xl bg-black/40 border-white/10 text-base placeholder:text-muted-foreground/60"
            placeholder="Enter your password"
          />
          <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white">
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </FieldIcon>
        <FieldIcon icon={Lock} label="Confirm Password">
          <Input
            type={showPw2 ? "text" : "password"}
            required
            value={form.confirm}
            onChange={(e) => set("confirm", e.target.value)}
            className="pl-11 pr-11 h-14 rounded-2xl bg-black/40 border-white/10 text-base placeholder:text-muted-foreground/60"
            placeholder="Confirm your password"
          />
          <button type="button" onClick={() => setShowPw2((s) => !s)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white">
            {showPw2 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </FieldIcon>

        <label className="flex items-start gap-2 pt-1 text-xs text-muted-foreground">
          <Checkbox checked={agree} onCheckedChange={(v) => setAgree(!!v)} className="mt-0.5" />
          <span>I agree to the <span className="font-semibold text-amber-400">Terms &amp; Conditions</span> and Privacy Policy.</span>
        </label>

        <div className="relative pt-2">
          <div aria-hidden className="pointer-events-none absolute inset-x-6 -bottom-2 h-8 rounded-full bg-red-500/60 blur-2xl" />
          <Button
            disabled={loading}
            className="relative w-full h-16 rounded-full bg-[linear-gradient(90deg,#dc2626_0%,#ef4444_35%,#f97316_75%,#fbbf24_100%)] hover:opacity-95 text-white border-0 font-bold text-lg tracking-wide shadow-[0_15px_45px_-8px_rgba(239,68,68,0.75)]"
            type="submit"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Register
          </Button>
        </div>
      </form>

      <div className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <button onClick={onSwitch} className="font-semibold text-amber-400 hover:text-amber-300">
          Login
        </button>
      </div>
    </>
  );
}

function ForgotForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return toast.error("Please enter your email");
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setSent(true);
    toast.success("Password reset link sent to your email");
  }

  return (
    <>
      <h2 className="text-xl font-semibold">Forgot password?</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Enter your email and we'll send you a link to reset your password.
      </p>

      {sent ? (
        <div className="mt-6 space-y-4">
          <div className="glass rounded-xl p-4 text-sm">
            We've sent a password reset link to <span className="font-semibold">{email}</span>.
            Check your inbox (and spam folder) and click the link to set a new password.
          </div>
          <Button
            onClick={onBack}
            className="w-full h-12 rounded-xl gradient-primary text-white border-0 font-semibold"
          >
            Back to sign in
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <FieldIcon icon={Mail} label="Email address">
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@gmail.com"
              className="pl-10 h-12 rounded-xl glass border-white/10"
            />
          </FieldIcon>

          <Button
            disabled={loading}
            type="submit"
            className="w-full h-12 rounded-xl gradient-primary text-white border-0 font-semibold shadow-lg shadow-primary/30"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send reset link
          </Button>

          <button
            type="button"
            onClick={onBack}
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to sign in
          </button>
        </form>
      )}
    </>
  );
}

function FieldIcon({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</Label>
      <div className="relative mt-1">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        {children}
      </div>
    </div>
  );
}