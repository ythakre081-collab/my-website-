import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink, Plus, Pencil, Trash2, Search, Link2, Upload, Loader2, X, Copy, Share2, Crown, PlayCircle } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { logActivity } from "@/lib/activity-log";

type Link = {
  id: string;
  title: string;
  url: string;
  description: string | null;
  category: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  help_video_url?: string | null;
};

function useSignedLogo(path: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!path) { setUrl(null); return; }
    if (/^https?:\/\//i.test(path) || path.startsWith("data:")) { setUrl(path); return; }
    supabase.storage.from("link-logos").createSignedUrl(path, 60 * 60).then(({ data }) => {
      if (!cancelled) setUrl(data?.signedUrl ?? null);
    });
    return () => { cancelled = true; };
  }, [path]);
  return url;
}

function LinkLogo({ icon, title }: { icon: string | null; title: string }) {
  const url = useSignedLogo(icon);
  const initials = title.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <div className="relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/15 bg-white p-2 shadow-[0_18px_40px_-18px_hsl(var(--primary)/0.7)] sm:h-24 sm:w-24">
      {url ? (
        <img src={url} alt={`${title} logo`} className="h-full w-full object-contain" loading="eager" decoding="async" />
      ) : (
        <div className="grid h-full w-full place-items-center bg-gradient-to-br from-primary/30 via-accent/20 to-primary/10">
          <span className="text-3xl font-black text-gradient">{initials || <Link2 className="h-10 w-10" />}</span>
        </div>
      )}
    </div>
  );
}

export type ReferralLinksSectionProps = {
  pageTitle: string;
  pageDescription: string;
  /** When set, only links whose category matches (case-insensitive) are shown, and new links are locked to this category. */
  categoryFilter?: string;
  /** When categoryFilter is set, allow user to override the category in the editor. Defaults to false. */
  allowCategoryEdit?: boolean;
};

export function ReferralLinksSection({
  pageTitle,
  pageDescription,
  categoryFilter,
  allowCategoryEdit = false,
}: ReferralLinksSectionProps) {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const empty: Partial<Link> = {
    title: "",
    url: "",
    description: "",
    category: categoryFilter ?? "",
    icon: "",
    sort_order: 0,
    is_active: true,
    help_video_url: "",
  };
  const [rows, setRows] = useState<Link[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Link>>(empty);
  const [uploading, setUploading] = useState(false);
  const editorLogo = useSignedLogo(editing.icon ?? null);

  const uploadLogo = async (file: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Logo must be under 10 MB"); return; }
    setUploading(true);
    const previousIcon = editing.icon;
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("link-logos").upload(path, file, {
      contentType: file.type || "image/png",
      upsert: false,
    });
    if (error) { setUploading(false); toast.error(error.message); return; }

    if (editing.id) {
      const { error: updateError } = await supabase.from("important_links").update({ icon: path }).eq("id", editing.id);
      if (updateError) {
        await supabase.storage.from("link-logos").remove([path]);
        setUploading(false);
        toast.error(updateError.message);
        return;
      }
      setRows((prev) => prev.map((row) => row.id === editing.id ? { ...row, icon: path } : row));
      await logActivity({ action: "update", entity_type: "important_link", entity_id: editing.id });
      if (previousIcon && !/^https?:\/\//i.test(previousIcon) && !previousIcon.startsWith("data:")) {
        await supabase.storage.from("link-logos").remove([previousIcon]);
      }
    }

    setUploading(false);
    setEditing((prev) => ({ ...prev, icon: path }));
    toast.success(editing.id ? "Logo uploaded and saved" : "Logo uploaded");
  };

  const clearLogo = async () => {
    const p = editing.icon;
    setEditing((prev) => ({ ...prev, icon: "" }));
    if (editing.id) {
      const { error } = await supabase.from("important_links").update({ icon: null }).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      setRows((prev) => prev.map((row) => row.id === editing.id ? { ...row, icon: null } : row));
      await logActivity({ action: "update", entity_type: "important_link", entity_id: editing.id });
      toast.success("Logo removed");
    }
    if (p && !/^https?:\/\//i.test(p) && !p.startsWith("data:")) {
      await supabase.storage.from("link-logos").remove([p]);
    }
  };

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("important_links").select("*").order("sort_order").order("created_at", { ascending: false });
      setRows((data ?? []) as Link[]);
    };
    load();
    const ch = supabase.channel(`important_links_rt_${categoryFilter ?? "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "important_links" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [categoryFilter]);

  const scoped = useMemo(() => {
    if (!categoryFilter) return rows;
    const key = categoryFilter.trim().toLowerCase();
    return rows.filter((r) => (r.category ?? "").trim().toLowerCase() === key);
  }, [rows, categoryFilter]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return scoped;
    return scoped.filter((r) => `${r.title} ${r.category ?? ""} ${r.description ?? ""}`.toLowerCase().includes(s));
  }, [scoped, q]);

  const grouped = useMemo(() => {
    const map = new Map<string, Link[]>();
    for (const l of filtered) {
      const k = l.category?.trim() || "General";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(l);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const save = async () => {
    if (!editing.title || !editing.url) { toast.error("Title and URL are required"); return; }
    const category = categoryFilter && !allowCategoryEdit
      ? categoryFilter
      : (editing.category?.trim() || categoryFilter || null);
    const payload = {
      title: editing.title!,
      url: editing.url!,
      description: editing.description ?? null,
      category,
      icon: editing.icon ? editing.icon : null,
      sort_order: Number(editing.sort_order ?? 0),
      is_active: editing.is_active ?? true,
      help_video_url: editing.help_video_url?.trim() ? editing.help_video_url.trim() : null,
    };
    if (editing.id) {
      const { error } = await supabase.from("important_links").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      await logActivity({ action: "update", entity_type: "important_link", entity_id: editing.id });
      toast.success("Link updated");
    } else {
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("important_links").insert({ ...payload, created_by: auth.user?.id ?? null }).select().single();
      if (error) return toast.error(error.message);
      await logActivity({ action: "create", entity_type: "important_link", entity_id: data?.id });
      toast.success("Link added");
    }
    setOpen(false); setEditing(empty);
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this link?")) return;
    const { error } = await supabase.from("important_links").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await logActivity({ action: "delete", entity_type: "important_link", entity_id: id });
    toast.success("Link deleted");
  };

  return (
    <PageShell title={pageTitle} description={pageDescription}
      actions={isAdmin ? (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(empty); }}>
          <DialogTrigger asChild><Button className="gradient-primary text-white"><Plus className="mr-2 h-4 w-4" />Add Referral</Button></DialogTrigger>
          <DialogContent className="glass-strong max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing.id ? "Edit Link" : "New Link"}</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div>
                <Label>Logo</Label>
                <div className="mt-2 flex items-center gap-4">
                  <div className="relative grid h-20 w-32 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-white p-2">
                    {editorLogo ? (
                      <img src={editorLogo} alt="logo preview" className="h-full w-full object-contain" />
                    ) : (
                      <Link2 className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10">
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      {uploading ? "Uploading…" : editing.icon ? "Replace logo" : "Upload logo"}
                      <input type="file" accept="image/*" className="hidden" disabled={uploading}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = ""; }} />
                    </label>
                    {editing.icon && (
                      <Button type="button" variant="ghost" size="sm" onClick={clearLogo} className="justify-start text-rose-400 hover:text-rose-300">
                        <X className="mr-1 h-3.5 w-3.5" />Remove
                      </Button>
                    )}
                    <p className="text-[11px] text-muted-foreground">PNG/JPG/SVG, max 10 MB</p>
                  </div>
                </div>
              </div>
              <div><Label>Title</Label><Input value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
              <div><Label>URL</Label><Input value={editing.url ?? ""} onChange={(e) => setEditing({ ...editing, url: e.target.value })} placeholder="https://..." /></div>
              <div><Label>Account Open Video URL (YouTube)</Label><Input value={editing.help_video_url ?? ""} onChange={(e) => setEditing({ ...editing, help_video_url: e.target.value })} placeholder="https://youtube.com/..." /></div>
              {(!categoryFilter || allowCategoryEdit) && (
                <div><Label>Category</Label><Input value={editing.category ?? ""} onChange={(e) => setEditing({ ...editing, category: e.target.value })} placeholder="Broker / Referral / Training" /></div>
              )}
              <div><Label>Description / Terms & Conditions</Label><Textarea rows={8} className="min-h-[180px]" placeholder="Terms & conditions, offer details, KYC requirements…" value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Sort</Label><Input type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} /></div>
                <div className="flex items-end gap-2"><Switch checked={editing.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} /><Label>Active</Label></div>
              </div>
            </div>
            <DialogFooter><Button onClick={save} className="gradient-primary text-white">{editing.id ? "Update" : "Create"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      ) : undefined}
    >
      <div className="mb-6 relative max-w-lg">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search links…" className="glass h-12 rounded-2xl pl-11 text-base" />
      </div>
      {grouped.length === 0 && <div className="glass rounded-2xl p-10 text-center text-muted-foreground">No links yet.</div>}
      <div className="space-y-10">
        {grouped.map(([cat, items]) => (
          <div key={cat}>
            <div className="mb-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-gradient-to-r from-primary/40 to-transparent" />
              <h3 className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">{cat}</h3>
              <div className="h-px flex-1 bg-gradient-to-l from-primary/40 to-transparent" />
            </div>
            <div className="grid gap-6 sm:gap-7 md:grid-cols-2 2xl:grid-cols-3">
              {items.map((l, i) => (
                <motion.div
                  key={l.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.35 }}
                  whileHover={{ y: -6 }}
                  className="group relative overflow-hidden rounded-[28px] border-2 border-fuchsia-500/70 bg-gradient-to-br from-[#1a0a2e] via-[#0f0820] to-[#1a0a2e] p-6 sm:p-7 backdrop-blur-xl shadow-[0_0_35px_-5px_rgba(232,80,220,0.55),inset_0_0_25px_-10px_rgba(232,80,220,0.35)] transition-all hover:border-fuchsia-400 hover:shadow-[0_0_55px_-5px_rgba(232,80,220,0.8),inset_0_0_35px_-10px_rgba(232,80,220,0.5)]"
                >
                  <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-fuchsia-500/30 blur-3xl" />
                  <div className="pointer-events-none absolute -left-20 -bottom-20 h-48 w-48 rounded-full bg-purple-500/25 blur-3xl" />
                  {l.is_active && (
                    <div className="relative z-10 mb-3 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-amber-950 shadow-[0_6px_20px_-4px_rgba(251,191,36,0.7)]">
                      <Crown className="h-3 w-3" />Premium
                    </div>
                  )}
                  <div className="relative flex items-start gap-4 sm:gap-5">
                    <LinkLogo icon={l.icon} title={l.title} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate bg-gradient-to-r from-fuchsia-400 via-pink-400 to-fuchsia-500 bg-clip-text text-2xl sm:text-3xl font-black tracking-tight leading-tight text-transparent">
                        {l.title}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {l.is_active ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />Active
                          </span>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">Hidden</Badge>
                        )}
                        {l.category && (
                          <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/80">
                            {l.category}
                          </span>
                        )}
                      </div>
                      {l.description && (
                        <div className="mt-3 max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                          {l.description}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="relative mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-fuchsia-500/20 pt-5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <Button asChild className="h-11 rounded-full border-0 bg-gradient-to-r from-emerald-500 to-green-600 px-5 text-sm font-bold text-white shadow-[0_8px_25px_-6px_rgba(16,185,129,0.7)] hover:brightness-110">
                        <a href={l.url} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-2 h-4 w-4" />Open
                        </a>
                      </Button>
                      <Button
                        type="button"
                        className="h-11 rounded-full border-0 bg-gradient-to-r from-sky-500 to-blue-600 px-5 text-sm font-bold text-white shadow-[0_8px_25px_-6px_rgba(59,130,246,0.7)] hover:brightness-110"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(l.url);
                            toast.success("Link copied");
                          } catch { toast.error("Copy failed"); }
                        }}
                      >
                        <Copy className="mr-2 h-4 w-4" />Copy
                      </Button>
                      <Button
                        type="button"
                        className="h-11 rounded-full border-0 bg-gradient-to-r from-orange-500 via-pink-500 to-fuchsia-500 px-5 text-sm font-bold text-white shadow-[0_8px_25px_-6px_rgba(236,72,153,0.7)] hover:brightness-110"
                        onClick={async () => {
                          const shareData = { title: l.title, text: l.description ?? l.title, url: l.url };
                          try {
                            if (typeof navigator !== "undefined" && (navigator as any).share) {
                              await (navigator as any).share(shareData);
                            } else {
                              const wa = `https://wa.me/?text=${encodeURIComponent(`${l.title}\n${l.url}`)}`;
                              window.open(wa, "_blank", "noopener,noreferrer");
                            }
                          } catch { /* user cancelled */ }
                        }}
                      >
                        <Share2 className="mr-2 h-4 w-4" />Share
                      </Button>
                      {l.help_video_url && (
                        <Button asChild className="h-11 rounded-full border-0 bg-gradient-to-r from-red-600 via-rose-600 to-red-700 px-5 text-sm font-bold text-white shadow-[0_8px_25px_-6px_rgba(239,68,68,0.7)] hover:brightness-110">
                          <a href={l.help_video_url} target="_blank" rel="noreferrer">
                            <PlayCircle className="mr-2 h-4 w-4" />Account Open Video
                          </a>
                        </Button>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1.5">
                        <Button size="icon" variant="ghost" className="h-11 w-11 rounded-xl border border-white/10 hover:bg-white/10" onClick={() => { setEditing(l); setOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-11 w-11 rounded-xl border border-white/10 hover:bg-rose-500/10" onClick={() => remove(l.id)}>
                          <Trash2 className="h-4 w-4 text-rose-400" />
                        </Button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}