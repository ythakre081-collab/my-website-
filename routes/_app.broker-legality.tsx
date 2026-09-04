import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, ShieldAlert, Plus, Pencil, Trash2, Upload, Loader2, Search, X, Eye, Building2, CalendarDays, BadgeCheck, Download, Star, ExternalLink } from "lucide-react";
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

export const Route = createFileRoute("/_app/broker-legality")({ component: BrokerLegalityPage });

type Row = {
  id: string;
  broker_name: string;
  launched_year: string | null;
  is_legal: boolean;
  regulator: string | null;
  registration_no: string | null;
  description: string | null;
  poster_path: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  play_store_downloads: string | null;
  play_store_rating: number | null;
  play_store_url: string | null;
};

const empty: Partial<Row> = { broker_name: "", launched_year: "", is_legal: true, regulator: "SEBI", registration_no: "", description: "", poster_path: "", sort_order: 0, is_active: true, play_store_downloads: "", play_store_rating: null, play_store_url: "" };

function BrokerLegalityPage() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [rows, setRows] = useState<Row[]>([]);
  const [posterUrls, setPosterUrls] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Row>>(empty);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<{ row: Row; url: string } | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("broker_legality").select("*").order("sort_order").order("broker_name");
      const list = (data ?? []) as Row[];
      setRows(list);
      const urls: Record<string, string> = {};
      await Promise.all(list.filter(r => r.poster_path).map(async (r) => {
        const { data: signed } = await supabase.storage.from("broker-legality").createSignedUrl(r.poster_path!, 60 * 60);
        if (signed?.signedUrl) urls[r.id] = signed.signedUrl;
      }));
      setPosterUrls(urls);
    };
    load();
    const ch = supabase.channel("broker_legality_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "broker_legality" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(r => `${r.broker_name} ${r.regulator ?? ""} ${r.description ?? ""}`.toLowerCase().includes(s));
  }, [rows, q]);

  const uploadPoster = async (file: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Image must be under 10 MB"); return; }
    setUploading(true);
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("broker-legality").upload(path, file, { contentType: file.type || "image/png", upsert: false });
    setUploading(false);
    if (error) { toast.error(error.message); return; }
    setEditing(prev => ({ ...prev, poster_path: path }));
    toast.success("Poster uploaded");
  };

  const clearPoster = async () => {
    const p = editing.poster_path;
    setEditing(prev => ({ ...prev, poster_path: "" }));
    if (p) await supabase.storage.from("broker-legality").remove([p]);
  };

  const save = async () => {
    if (!editing.broker_name) { toast.error("Broker name is required"); return; }
    if (saving) return;
    setSaving(true);
    const payload = {
      broker_name: editing.broker_name!,
      launched_year: editing.launched_year ?? null,
      is_legal: editing.is_legal ?? true,
      regulator: editing.regulator ?? null,
      registration_no: editing.registration_no ?? null,
      description: editing.description ?? null,
      poster_path: editing.poster_path || null,
      sort_order: Number(editing.sort_order ?? 0),
      is_active: editing.is_active ?? true,
      play_store_downloads: editing.play_store_downloads || null,
      play_store_rating: editing.play_store_rating ? Number(editing.play_store_rating) : null,
      play_store_url: editing.play_store_url || null,
    };
    if (editing.id) {
      const { error } = await supabase.from("broker_legality").update(payload).eq("id", editing.id);
      if (error) { setSaving(false); return toast.error(error.message); }
      toast.success("Updated");
    } else {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("broker_legality").insert({ ...payload, created_by: auth.user?.id ?? null });
      if (error) { setSaving(false); return toast.error(error.message); }
      toast.success("Added");
    }
    setOpen(false); setEditing(empty); setSaving(false);
  };

  const remove = async (r: Row) => {
    if (!confirm(`Delete "${r.broker_name}"?`)) return;
    if (r.poster_path) await supabase.storage.from("broker-legality").remove([r.poster_path]);
    const { error } = await supabase.from("broker_legality").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
  };

  return (
    <PageShell
      title="Refer App Legality"
      description="SEBI registration & legal status of every broker app we refer — 100% verified & transparent."
      actions={isAdmin ? (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(empty); }}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-white"><Plus className="mr-2 h-4 w-4" />Add Broker</Button>
          </DialogTrigger>
          <DialogContent className="glass-strong max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing.id ? "Edit Broker" : "New Broker"}</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div>
                <Label>Legality Poster / Screenshot</Label>
                <div className="mt-2 flex items-center gap-4">
                  <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/20 via-cyan-500/20 to-blue-500/10">
                    {editing.poster_path
                      ? <div className="grid h-full w-full place-items-center text-xs text-emerald-300">Uploaded</div>
                      : <ShieldCheck className="h-8 w-8 text-white/70" />}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10">
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      {uploading ? "Uploading…" : editing.poster_path ? "Replace poster" : "Upload poster"}
                      <input type="file" accept="image/*" className="hidden" disabled={uploading}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPoster(f); e.target.value = ""; }} />
                    </label>
                    {editing.poster_path && (
                      <Button type="button" variant="ghost" size="sm" onClick={clearPoster} className="h-7 w-fit text-rose-400 hover:text-rose-300">
                        <X className="mr-1 h-3.5 w-3.5" />Remove
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <div><Label>Broker Name</Label><Input value={editing.broker_name ?? ""} onChange={(e) => setEditing({ ...editing, broker_name: e.target.value })} placeholder="e.g. Angel One" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Launched Year</Label><Input value={editing.launched_year ?? ""} onChange={(e) => setEditing({ ...editing, launched_year: e.target.value })} placeholder="1987" /></div>
                <div><Label>Regulator</Label><Input value={editing.regulator ?? ""} onChange={(e) => setEditing({ ...editing, regulator: e.target.value })} placeholder="SEBI" /></div>
              </div>
              <div><Label>Registration No.</Label><Input value={editing.registration_no ?? ""} onChange={(e) => setEditing({ ...editing, registration_no: e.target.value })} placeholder="INZ000..." /></div>
              <div><Label>Description</Label><Textarea rows={3} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Play Store Downloads</Label><Input value={editing.play_store_downloads ?? ""} onChange={(e) => setEditing({ ...editing, play_store_downloads: e.target.value })} placeholder="e.g. 10M+" /></div>
                <div><Label>Play Store Rating</Label><Input type="number" step="0.1" min="0" max="5" value={editing.play_store_rating ?? ""} onChange={(e) => setEditing({ ...editing, play_store_rating: e.target.value === "" ? null : Number(e.target.value) as any })} placeholder="4.3" /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Sort</Label><Input type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} /></div>
                <div className="flex items-end gap-2"><Switch checked={editing.is_legal ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_legal: v })} /><Label>Legal</Label></div>
                <div className="flex items-end gap-2"><Switch checked={editing.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} /><Label>Active</Label></div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={save} disabled={saving || uploading} className="gradient-primary text-white">
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : editing.id ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : undefined}
    >
      <div className="mb-6 relative max-w-lg">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search broker…" className="glass h-12 rounded-2xl pl-11 text-base" />
      </div>

      {filtered.length === 0 && (
        <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
          <ShieldCheck className="mx-auto mb-2 h-8 w-8 opacity-40" />No brokers yet.
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((r, i) => {
          const url = posterUrls[r.id];
          return (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="group relative overflow-hidden rounded-2xl p-[1.5px] bg-[conic-gradient(from_var(--ang,0deg),#10b981,#06b6d4,#3b82f6,#8b5cf6,#10b981)]"
              style={{ ["--ang" as any]: `${(i * 40) % 360}deg` }}
            >
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0b1120]/95 via-[#0a0f1c]/95 to-[#080d18]/95 p-5">
                {/* Poster */}
                <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-black/40">
                  {url ? (
                    <img src={url} alt={r.broker_name} className="h-full w-full object-cover cursor-zoom-in" onClick={() => setPreview({ row: r, url })} loading="lazy" />
                  ) : (
                    <div className="relative h-full w-full overflow-hidden bg-[linear-gradient(135deg,#1e1b4b_0%,#312e81_35%,#7c2d12_100%)]">
                      {/* subtle diagonal shine */}
                      <div className="absolute -inset-1 bg-[linear-gradient(115deg,transparent_40%,rgba(255,255,255,0.08)_50%,transparent_60%)]" />
                      {/* gold corner accents */}
                      <div className="absolute top-2 right-2 h-6 w-6 border-t-2 border-r-2 border-amber-300/70" />
                      <div className="absolute bottom-2 left-2 h-6 w-6 border-b-2 border-l-2 border-amber-300/70" />
                      <div className="relative z-10 flex h-full w-full flex-col items-center justify-center px-4 text-center">
                        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-black shadow-[0_4px_16px_rgba(251,191,36,0.5)]">
                          <ShieldCheck className="h-3 w-3" />SEBI Verified
                        </div>
                        <div
                          className="text-3xl font-black tracking-tight text-white sm:text-4xl"
                          style={{ textShadow: "0 2px 4px rgba(0,0,0,0.5), 0 0 24px rgba(251,191,36,0.35)" }}
                        >
                          {r.broker_name}
                        </div>
                        <div className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.3em] text-amber-200/95">
                          {r.launched_year ? `EST. ${r.launched_year}` : "Registered Broker"}
                        </div>
                        {r.registration_no && (
                          <div className="mt-2.5 rounded-md border border-amber-300/40 bg-black/50 px-2.5 py-1 font-mono text-[10px] text-amber-100">
                            {r.registration_no}
                          </div>
                        )}
                        <div className="mt-2.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.3em] text-amber-300">
                          <span>★</span><span>100% Legal</span><span>★</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="absolute top-2 left-2">
                    {r.is_legal ? (
                      <Badge className="bg-emerald-500/90 text-white border-0 shadow-lg"><ShieldCheck className="mr-1 h-3 w-3" />100% LEGAL</Badge>
                    ) : (
                      <Badge className="bg-rose-500/90 text-white border-0 shadow-lg"><ShieldAlert className="mr-1 h-3 w-3" />NOT VERIFIED</Badge>
                    )}
                  </div>
                </div>

                {/* Header */}
                <div className="mt-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-black tracking-tight text-white">{r.broker_name}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                      {r.launched_year && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-white/80 border border-white/10">
                          <CalendarDays className="h-3 w-3" />Since {r.launched_year}
                        </span>
                      )}
                      {r.regulator && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-300 border border-emerald-500/30">
                          <BadgeCheck className="h-3 w-3" />{r.regulator}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {r.registration_no && (
                  <div className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-mono text-white/80">
                    Reg: {r.registration_no}
                  </div>
                )}

                {(r.play_store_downloads || r.play_store_rating) && (
                  <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-green-500/10 to-teal-500/10 px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-emerald-400 to-blue-500 shadow-lg">
                        <Download className="h-4 w-4 text-white" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-wider text-white/60 leading-tight">Play Store</div>
                        <div className="flex items-center gap-2 text-xs font-bold text-white leading-tight">
                          {r.play_store_downloads && <span>{r.play_store_downloads} downloads</span>}
                          {r.play_store_rating != null && (
                            <span className="inline-flex items-center gap-0.5 text-amber-300">
                              <Star className="h-3 w-3 fill-amber-300" />{r.play_store_rating}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {r.description && (
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground line-clamp-3">{r.description}</p>
                )}

                <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/10 pt-3">
                  {url ? (
                    <Button size="sm" onClick={() => setPreview({ row: r, url })} className="gradient-primary text-white h-9">
                      <Eye className="mr-1.5 h-4 w-4" />View Proof
                    </Button>
                  ) : <span className="text-xs text-muted-foreground">No poster</span>}
                  {isAdmin && (
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => { setEditing(r); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => remove(r)}><Trash2 className="h-4 w-4 text-rose-400" /></Button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <Dialog open={!!preview} onOpenChange={(v) => { if (!v) setPreview(null); }}>
        <DialogContent className="glass-strong max-w-4xl w-[95vw] p-0 overflow-hidden">
          <DialogHeader className="px-5 py-3 border-b border-white/10">
            <DialogTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              {preview?.row.broker_name} — Legality Proof
            </DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="bg-black/60 grid place-items-center p-4 max-h-[80vh] overflow-auto">
              <img src={preview.url} alt={preview.row.broker_name} className="max-h-[75vh] max-w-full object-contain rounded-lg" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}