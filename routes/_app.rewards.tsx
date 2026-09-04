import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Gift, Plus, Pencil, Trash2, Trophy, IndianRupee, Sparkles, Upload, Loader2, X, ImagePlus, Calendar, Download, Share2 } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { logActivity } from "@/lib/activity-log";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/rewards")({ component: RewardsPage });

type Reward = { id: string; title: string; description: string | null; image_url: string | null; milestone_amount: number; is_active: boolean; sort_order: number };
type Unlock = { reward_id: string };
type Poster = { id: string; title: string; description: string | null; image_url: string; month_label: string | null; is_active: boolean; sort_order: number };

const empty: Partial<Reward> = { title: "", description: "", image_url: "", milestone_amount: 0, is_active: true, sort_order: 0 };

function useRewardImage(path: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!path) { setUrl(null); return; }
    if (/^https?:\/\//i.test(path) || path.startsWith("data:")) { setUrl(path); return; }
    supabase.storage.from("reward-images").createSignedUrl(path, 60 * 60).then(({ data }) => {
      if (!cancelled) setUrl(data?.signedUrl ?? null);
    });
    return () => { cancelled = true; };
  }, [path]);
  return url;
}

function RewardImage({ path, title }: { path: string | null; title: string }) {
  const url = useRewardImage(path);
  if (!url) return <div className="grid h-full w-full place-items-center bg-gradient-to-br from-primary/30 to-accent/20"><Gift className="h-16 w-16 text-white/80" /></div>;
  return <img src={url} alt={title} className="h-full w-full object-contain p-3" loading="lazy" />;
}

function PosterImage({ path, title }: { path: string; title: string }) {
  const url = useRewardImage(path);
  if (!url) return <div className="grid h-full w-full place-items-center bg-gradient-to-br from-fuchsia-500/30 to-amber-500/20"><Sparkles className="h-10 w-10 text-white/80" /></div>;
  return <img src={url} alt={title} className="h-full w-full object-cover" loading="lazy" />;
}

const emptyPoster: Partial<Poster> = { title: "", description: "", image_url: "", month_label: "", is_active: true, sort_order: 0 };

function SpecialOfferPosters({ isAdmin }: { isAdmin: boolean }) {
  const [posters, setPosters] = useState<Poster[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Poster>>(emptyPoster);
  const [uploading, setUploading] = useState(false);
  const previewUrl = useRewardImage(editing.image_url ?? null);

  const downloadPoster = async (path: string, title: string) => {
    try {
      let url = path;
      if (!/^https?:\/\//i.test(path) && !path.startsWith("data:")) {
        const { data, error } = await supabase.storage.from("reward-images").createSignedUrl(path, 60 * 5);
        if (error || !data?.signedUrl) throw error ?? new Error("URL nahi mila");
        url = data.signedUrl;
      }
      const res = await fetch(url);
      const blob = await res.blob();
      const ext = (blob.type.split("/")[1] || "png").replace("jpeg", "jpg");
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `${title.replace(/[^a-z0-9\-_ ]/gi, "_")}.${ext}`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      toast.success("Poster downloaded — ab WhatsApp status pe laga do");
    } catch (e) {
      toast.error((e as Error).message || "Download fail hua");
    }
  };

  const shareToWhatsApp = async (path: string, title: string, description: string | null) => {
    try {
      let url = path;
      if (!/^https?:\/\//i.test(path) && !path.startsWith("data:")) {
        const { data, error } = await supabase.storage.from("reward-images").createSignedUrl(path, 60 * 60);
        if (error || !data?.signedUrl) throw error ?? new Error("URL nahi mila");
        url = data.signedUrl;
      }
      // Try native share with file (mobile) — better for status
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        const ext = (blob.type.split("/")[1] || "png").replace("jpeg", "jpg");
        const file = new File([blob], `${title.replace(/[^a-z0-9\-_ ]/gi, "_")}.${ext}`, { type: blob.type || "image/png" });
        const navAny = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
        if (navAny.canShare && navAny.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title, text: description ?? title });
          return;
        }
      } catch { /* fall through */ }
      const text = encodeURIComponent(`${title}${description ? `\n${description}` : ""}\n${url}`);
      window.open(`https://wa.me/?text=${text}`, "_blank");
    } catch (e) {
      toast.error((e as Error).message || "Share fail hua");
    }
  };

  const load = async () => {
    const q = supabase.from("special_offer_posters").select("*").order("sort_order").order("created_at", { ascending: false });
    const { data } = isAdmin ? await q : await q.eq("is_active", true);
    setPosters((data ?? []) as Poster[]);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("special_offer_posters_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "special_offer_posters" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const uploadImage = async (file: File) => {
    if (file.size > 8 * 1024 * 1024) { toast.error("Image must be under 8 MB"); return; }
    setUploading(true);
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `offers/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("reward-images").upload(path, file, { contentType: file.type || "image/png", upsert: false });
    setUploading(false);
    if (error) return toast.error(error.message);
    setEditing((prev) => ({ ...prev, image_url: path }));
    toast.success("Poster uploaded");
  };

  const save = async () => {
    if (!editing.title) return toast.error("Title required");
    if (!editing.image_url) return toast.error("Poster image required");
    const payload = {
      title: editing.title!,
      description: editing.description ?? null,
      image_url: editing.image_url!,
      month_label: editing.month_label || null,
      is_active: editing.is_active ?? true,
      sort_order: Number(editing.sort_order ?? 0),
    };
    if (editing.id) {
      const { error } = await supabase.from("special_offer_posters").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Poster updated");
    } else {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("special_offer_posters").insert({ ...payload, created_by: auth.user?.id ?? null });
      if (error) return toast.error(error.message);
      toast.success("Poster added");
    }
    setOpen(false); setEditing(emptyPoster);
  };

  const remove = async (id: string, path: string) => {
    if (!confirm("Delete poster?")) return;
    const { error } = await supabase.from("special_offer_posters").delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (path && !/^https?:\/\//i.test(path)) await supabase.storage.from("reward-images").remove([path]);
    toast.success("Poster removed");
  };

  return (
    <div className="mb-8">
      <div className="flex items-end justify-between gap-3 mb-4">
        <div>
          <h2 className="text-2xl font-black bg-gradient-to-r from-amber-400 via-rose-400 to-fuchsia-400 bg-clip-text text-transparent">Monthly Special Offer Posters</h2>
          <p className="text-xs text-muted-foreground mt-1">Fresh promotional banners uploaded every month</p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(emptyPoster); }}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-amber-500 via-rose-500 to-fuchsia-500 text-white hover:opacity-90">
                <ImagePlus className="mr-2 h-4 w-4" />Add Poster
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-strong max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editing.id ? "Edit Poster" : "New Special Offer Poster"}</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div>
                  <Label>Poster image</Label>
                  <div className="mt-2 flex items-center gap-4">
                    <div className="relative grid h-28 w-40 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-amber-500/25 via-rose-500/20 to-fuchsia-500/25">
                      {previewUrl ? <img src={previewUrl} alt="preview" className="h-full w-full object-cover" /> : <Sparkles className="h-8 w-8 text-muted-foreground" />}
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10">
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        {uploading ? "Uploading…" : editing.image_url ? "Replace image" : "Upload image"}
                        <input type="file" accept="image/*" className="hidden" disabled={uploading}
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ""; }} />
                      </label>
                      {editing.image_url && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing((p) => ({ ...p, image_url: "" }))} className="justify-start text-rose-400 hover:text-rose-300">
                          <X className="mr-1 h-3.5 w-3.5" />Remove
                        </Button>
                      )}
                      <p className="text-[11px] text-muted-foreground">PNG/JPG/WebP, max 8 MB</p>
                    </div>
                  </div>
                </div>
                <div><Label>Title</Label><Input value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="Diwali Bumper Offer" /></div>
                <div><Label>Month / Tag</Label><Input value={editing.month_label ?? ""} onChange={(e) => setEditing({ ...editing, month_label: e.target.value })} placeholder="November 2026" /></div>
                <div><Label>Description</Label><Textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="Kya offer hai, kaise claim karna hai…" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Sort</Label><Input type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} /></div>
                  <div className="flex items-center gap-2 pt-6"><Switch checked={editing.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} /><Label>Active</Label></div>
                </div>
              </div>
              <DialogFooter><Button onClick={save} className="bg-gradient-to-r from-amber-500 via-rose-500 to-fuchsia-500 text-white">{editing.id ? "Update" : "Publish"}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
      {posters.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center text-muted-foreground text-sm">
          {isAdmin ? "Koi poster nahi hai. Add Poster dabao aur monthly special offer upload karo." : "Is mahine ke special offers jaldi aa rahe hain."}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posters.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="group relative rounded-2xl p-[1.5px] bg-[conic-gradient(from_0deg,rgba(251,191,36,0.9),rgba(244,63,94,0.9),rgba(217,70,239,0.9),rgba(251,191,36,0.9))] shadow-[0_20px_60px_-20px_rgba(244,63,94,0.55)] hover:shadow-[0_25px_80px_-15px_rgba(217,70,239,0.7)] transition-shadow">
              <div className="absolute -inset-2 -z-10 rounded-3xl bg-gradient-to-br from-amber-500/20 via-rose-500/15 to-fuchsia-500/20 blur-2xl opacity-70 group-hover:opacity-100 transition-opacity" />
              <div className="relative rounded-[14px] overflow-hidden bg-gradient-to-b from-zinc-950 via-zinc-900 to-black">
              <div className="absolute top-0 left-0 z-20 overflow-hidden rounded-tl-[14px]">
                <div className="relative bg-gradient-to-r from-amber-400 via-rose-500 to-fuchsia-500 px-3 py-1 text-[10px] font-black tracking-widest text-white shadow-lg flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />PREMIUM
                  <div className="absolute inset-0 -translate-x-full animate-[shimmer_2.5s_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                </div>
              </div>
              <div className="relative aspect-[4/5] overflow-hidden bg-black/40">
                <PosterImage path={p.image_url} title={p.title} />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />
                {p.month_label && (
                  <div className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/80 backdrop-blur px-2.5 py-1 text-[10px] font-bold text-amber-200 border border-amber-400/50 shadow-[0_0_15px_rgba(251,191,36,0.5)]">
                    <Calendar className="h-3 w-3" />{p.month_label}
                  </div>
                )}
                {!p.is_active && isAdmin && <Badge className="absolute bottom-2 right-2" variant="secondary">Hidden</Badge>}
              </div>
              <div className="p-4 bg-gradient-to-b from-black/60 to-zinc-950/80 backdrop-blur">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-black text-base bg-gradient-to-r from-amber-200 via-rose-200 to-fuchsia-200 bg-clip-text text-transparent">{p.title}</div>
                    {p.description && <p className="mt-1 text-xs text-zinc-400 line-clamp-2">{p.description}</p>}
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1 shrink-0">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(p); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(p.id, p.image_url)}><Trash2 className="h-4 w-4 text-rose-400" /></Button>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => downloadPoster(p.image_url, p.title)}
                    className="group/btn relative flex-1 overflow-hidden rounded-xl p-[1.5px] bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 shadow-[0_8px_25px_-8px_rgba(251,146,60,0.7)] hover:shadow-[0_10px_30px_-5px_rgba(244,63,94,0.8)] transition-shadow">
                    <span className="relative flex items-center justify-center gap-1.5 rounded-[10px] bg-zinc-950/90 px-3 py-2 text-xs font-bold text-white">
                      <Download className="h-3.5 w-3.5 text-amber-300" />Download
                      <span className="absolute inset-0 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                    </span>
                  </button>
                  <button onClick={() => shareToWhatsApp(p.image_url, p.title, p.description)}
                    className="group/btn relative flex-1 overflow-hidden rounded-xl p-[1.5px] bg-gradient-to-r from-emerald-400 via-green-500 to-teal-500 shadow-[0_8px_25px_-8px_rgba(16,185,129,0.7)] hover:shadow-[0_10px_30px_-5px_rgba(20,184,166,0.8)] transition-shadow">
                    <span className="relative flex items-center justify-center gap-1.5 rounded-[10px] bg-gradient-to-br from-emerald-600 to-green-700 px-3 py-2 text-xs font-bold text-white">
                      <Share2 className="h-3.5 w-3.5" />WhatsApp
                      <span className="absolute inset-0 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                    </span>
                  </button>
                </div>
              </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function RewardsPage() {
  const { role, user } = useAuth();
  const isAdmin = role === "admin";
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [unlocks, setUnlocks] = useState<Unlock[]>([]);
  const [lifetime, setLifetime] = useState(0);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Reward>>(empty);
  const [uploading, setUploading] = useState(false);
  const editorImage = useRewardImage(editing.image_url ?? null);
  const [banner, setBanner] = useState<string | null>(null);
  const [bannerUploading, setBannerUploading] = useState(false);

  const loadBanner = async () => {
    const { data } = await supabase.from("app_settings").select("rewards_banner_url").eq("id", true).maybeSingle();
    setBanner((data as { rewards_banner_url: string | null } | null)?.rewards_banner_url ?? null);
  };

  const uploadBanner = async (file: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Banner must be under 10 MB"); return; }
    setBannerUploading(true);
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `rewards-banner-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("reward-images").upload(path, file, { contentType: file.type || "image/png", upsert: false });
    if (upErr) { setBannerUploading(false); toast.error(upErr.message); return; }
    const { error } = await supabase.from("app_settings").update({ rewards_banner_url: path }).eq("id", true);
    setBannerUploading(false);
    if (error) return toast.error(error.message);
    setBanner(path); toast.success("Banner updated");
  };

  const removeBanner = async () => {
    if (!banner) return;
    if (!confirm("Remove rewards banner?")) return;
    if (!/^https?:\/\//i.test(banner)) await supabase.storage.from("reward-images").remove([banner]);
    const { error } = await supabase.from("app_settings").update({ rewards_banner_url: null }).eq("id", true);
    if (error) return toast.error(error.message);
    setBanner(null); toast.success("Banner removed");
  };

  const bannerUrl = useRewardImage(banner);

  const uploadImage = async (file: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5 MB"); return; }
    setUploading(true);
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("reward-images").upload(path, file, {
      contentType: file.type || "image/png",
      upsert: false,
    });
    setUploading(false);
    if (error) { toast.error(error.message); return; }
    setEditing((prev) => ({ ...prev, image_url: path }));
    toast.success("Image uploaded");
  };

  const clearImage = async () => {
    const p = editing.image_url;
    setEditing((prev) => ({ ...prev, image_url: "" }));
    if (p && !/^https?:\/\//i.test(p) && !p.startsWith("data:")) {
      await supabase.storage.from("reward-images").remove([p]);
    }
  };

  useEffect(() => {
    const load = async () => {
      const { data: r } = await supabase.from("rewards").select("*").order("sort_order").order("milestone_amount");
      setRewards((r ?? []) as Reward[]);
      if (user) {
        const [{ data: ur }, { data: tx }, { data: ov }] = await Promise.all([
          supabase.from("user_rewards").select("reward_id").eq("user_id", user.id),
          supabase.from("wallet_transactions").select("amount,type").eq("user_id", user.id).neq("type", "withdraw"),
          supabase.from("income_overrides").select("lifetime").eq("user_id", user.id).maybeSingle(),
        ]);
        setUnlocks((ur ?? []) as Unlock[]);
        const sum = (tx ?? []).reduce((s, t) => s + Number(t.amount || 0), 0);
        setLifetime(sum + Number(ov?.lifetime || 0));
      }
    };
    load();
    loadBanner();
    const ch = supabase.channel("rewards_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "rewards" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_rewards" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const unlockedIds = useMemo(() => new Set(unlocks.map(u => u.reward_id)), [unlocks]);

  const save = async () => {
    if (!editing.title) return toast.error("Title required");
    const payload = {
      title: editing.title!,
      description: editing.description ?? null,
      image_url: editing.image_url ? editing.image_url : null,
      milestone_amount: Number(editing.milestone_amount ?? 0),
      is_active: editing.is_active ?? true,
      sort_order: Number(editing.sort_order ?? 0),
    };
    if (editing.id) {
      const { error } = await supabase.from("rewards").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      await logActivity({ action: "update", entity_type: "reward", entity_id: editing.id });
      toast.success("Reward updated");
    } else {
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("rewards").insert({ ...payload, created_by: auth.user?.id ?? null }).select().single();
      if (error) return toast.error(error.message);
      await logActivity({ action: "create", entity_type: "reward", entity_id: data?.id });
      toast.success("Reward added");
    }
    setOpen(false); setEditing(empty);
  };

  const remove = async (id: string) => {
    if (!confirm("Delete reward?")) return;
    const { error } = await supabase.from("rewards").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await logActivity({ action: "delete", entity_type: "reward", entity_id: id });
    toast.success("Reward removed");
  };

  return (
    <PageShell title="Special Offers" description={isAdmin ? "Manage monthly offer posters and milestone rewards" : "Monthly special offers aur milestone rewards"}
      actions={isAdmin ? (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(empty); }}>
          <DialogTrigger asChild><Button className="gradient-primary text-white"><Plus className="mr-2 h-4 w-4" />Add Reward</Button></DialogTrigger>
          <DialogContent className="glass-strong max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing.id ? "Edit Reward" : "New Reward"}</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div>
                <Label>Reward image</Label>
                <div className="mt-2 flex items-center gap-4">
                  <div className="relative grid h-24 w-32 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-primary/30 via-accent/20 to-primary/10">
                    {editorImage ? (
                      <img src={editorImage} alt="reward preview" className="h-full w-full object-cover" />
                    ) : (
                      <Gift className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10">
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      {uploading ? "Uploading…" : editing.image_url ? "Replace image" : "Upload image"}
                      <input type="file" accept="image/*" className="hidden" disabled={uploading}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ""; }} />
                    </label>
                    {editing.image_url && (
                      <Button type="button" variant="ghost" size="sm" onClick={clearImage} className="justify-start text-rose-400 hover:text-rose-300">
                        <X className="mr-1 h-3.5 w-3.5" />Remove
                      </Button>
                    )}
                    <p className="text-[11px] text-muted-foreground">PNG/JPG/WebP, max 5 MB</p>
                  </div>
                </div>
              </div>
              <div><Label>Title</Label><Input value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
              <div><Label>Description</Label><Textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Milestone (₹)</Label><Input type="number" value={editing.milestone_amount ?? 0} onChange={(e) => setEditing({ ...editing, milestone_amount: Number(e.target.value) })} /></div>
                <div><Label>Sort</Label><Input type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} /></div>
              </div>
              <div className="flex items-center gap-2"><Switch checked={editing.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} /><Label>Active</Label></div>
            </div>
            <DialogFooter><Button onClick={save} className="gradient-primary text-white">{editing.id ? "Update" : "Create"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      ) : undefined}
    >
      {(banner || isAdmin) && (
        <div className="relative mb-6 overflow-hidden rounded-3xl border border-white/10">
          {bannerUrl ? (
            <img src={bannerUrl} alt="Rewards banner" className="w-full max-h-72 object-cover" />
          ) : (
            <div className="grid aspect-[5/1] w-full place-items-center bg-gradient-to-br from-primary/25 via-accent/15 to-primary/10 text-muted-foreground text-sm">
              No banner uploaded yet
            </div>
          )}
          {isAdmin && (
            <div className="absolute right-3 top-3 flex gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-black/60 backdrop-blur px-3 py-2 text-xs font-semibold text-white border border-white/20 hover:bg-black/70">
                {bannerUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {bannerUploading ? "Uploading…" : banner ? "Replace banner" : "Upload banner"}
                <input type="file" accept="image/*" className="hidden" disabled={bannerUploading}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadBanner(f); e.target.value = ""; }} />
              </label>
              {banner && (
                <Button size="sm" variant="destructive" onClick={removeBanner} className="h-9">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      )}
      <SpecialOfferPosters isAdmin={isAdmin} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rewards.map((r, i) => {
          const unlocked = isAdmin ? false : (unlockedIds.has(r.id) || lifetime >= Number(r.milestone_amount));
          const progress = Math.min(100, r.milestone_amount > 0 ? (lifetime / Number(r.milestone_amount)) * 100 : 100);
          return (
            <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className={cn("relative glass rounded-2xl overflow-hidden border transition-all",
                unlocked ? "border-primary/50 shadow-[0_0_40px_-10px_hsl(var(--primary)/0.6)]" : "border-white/5")}>
              <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-white via-white/95 to-white/85">
                <RewardImage path={r.image_url} title={r.title} />
                {unlocked && !isAdmin && (
                  <div className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-1 text-[11px] font-bold text-white">
                    <Sparkles className="h-3 w-3" />Unlocked
                  </div>
                )}
                {!r.is_active && isAdmin && <Badge className="absolute top-2 right-2" variant="secondary">Hidden</Badge>}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-bold">{r.title}</div>
                    <div className="text-xs text-muted-foreground">Milestone ₹{Number(r.milestone_amount).toLocaleString("en-IN")}</div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1 shrink-0">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4 text-rose-400" /></Button>
                    </div>
                  )}
                </div>
                {r.description && <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{r.description}</p>}
                {!isAdmin && (
                  <div className="mt-3">
                    <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full gradient-primary transition-all" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">{progress.toFixed(0)}% complete</div>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </PageShell>
  );
}