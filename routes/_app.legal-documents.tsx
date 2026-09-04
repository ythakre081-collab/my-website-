import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Scale, Plus, Pencil, Trash2, Upload, Loader2, FileText, Download, Search, X, Eye, ExternalLink } from "lucide-react";
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

export const Route = createFileRoute("/_app/legal-documents")({ component: LegalDocsPage });

type Doc = {
  id: string;
  title: string;
  description: string | null;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  category: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

const empty: Partial<Doc> = { title: "", description: "", file_path: "", file_type: "", file_size: 0, category: "", sort_order: 0, is_active: true };

function humanSize(n: number | null) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function LegalDocsPage() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [rows, setRows] = useState<Doc[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Doc>>(empty);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<{ doc: Doc; url: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("legal_documents").select("*").order("sort_order").order("created_at", { ascending: false });
      setRows((data ?? []) as Doc[]);
    };
    load();
    const ch = supabase.channel("legal_docs_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "legal_documents" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(r => `${r.title} ${r.category ?? ""} ${r.description ?? ""}`.toLowerCase().includes(s));
  }, [rows, q]);

  const uploadFile = async (file: File) => {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { toast.error("File must be under 25 MB"); return; }
    setUploading(true);
    const ext = (file.name.split(".").pop() || "pdf").toLowerCase();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("legal-documents").upload(path, file, { contentType: file.type || "application/pdf", upsert: false });
    setUploading(false);
    if (error) { toast.error(error.message); return; }
    setEditing((prev) => ({ ...prev, file_path: path, file_type: file.type || ext, file_size: file.size, title: prev.title || file.name.replace(/\.[^.]+$/, "") }));
    toast.success("File uploaded");
  };

  const clearFile = async () => {
    const p = editing.file_path;
    setEditing((prev) => ({ ...prev, file_path: "", file_type: "", file_size: 0 }));
    if (p) await supabase.storage.from("legal-documents").remove([p]);
  };

  const save = async () => {
    if (!editing.title || !editing.file_path) { toast.error("Title and file are required"); return; }
    if (saving) return;
    setSaving(true);
    const payload = {
      title: editing.title!,
      description: editing.description ?? null,
      file_path: editing.file_path!,
      file_type: editing.file_type ?? null,
      file_size: editing.file_size ?? null,
      category: editing.category ?? null,
      sort_order: Number(editing.sort_order ?? 0),
      is_active: editing.is_active ?? true,
    };
    if (editing.id) {
      const { error } = await supabase.from("legal_documents").update(payload).eq("id", editing.id);
      if (error) { setSaving(false); return toast.error(error.message); }
      await logActivity({ action: "update", entity_type: "legal_document", entity_id: editing.id });
      toast.success("Document updated");
    } else {
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("legal_documents").insert({ ...payload, created_by: auth.user?.id ?? null }).select().single();
      if (error) { setSaving(false); return toast.error(error.message); }
      await logActivity({ action: "create", entity_type: "legal_document", entity_id: data?.id });
      toast.success("Document added");
    }
    setOpen(false); setEditing(empty); setSaving(false);
  };

  const remove = async (d: Doc) => {
    if (!confirm(`Delete "${d.title}"?`)) return;
    if (d.file_path) await supabase.storage.from("legal-documents").remove([d.file_path]);
    const { error } = await supabase.from("legal_documents").delete().eq("id", d.id);
    if (error) return toast.error(error.message);
    await logActivity({ action: "delete", entity_type: "legal_document", entity_id: d.id });
    toast.success("Deleted");
  };

  const openDoc = async (d: Doc) => {
    setPreviewLoading(true);
    const { data } = await supabase.storage.from("legal-documents").createSignedUrl(d.file_path, 60 * 60);
    setPreviewLoading(false);
    if (data?.signedUrl) setPreview({ doc: d, url: data.signedUrl });
    else toast.error("Could not open file");
  };

  const isImage = (t: string | null | undefined) => !!t && (t.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)$/i.test(t));
  const isPdf = (t: string | null | undefined, path?: string) => (!!t && t.includes("pdf")) || /\.pdf$/i.test(path ?? "");

  return (
    <PageShell title="Legal Documents" description="Policies, agreements & official documents"
      actions={isAdmin ? (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(empty); }}>
          <DialogTrigger asChild><Button className="gradient-primary text-white"><Plus className="mr-2 h-4 w-4" />Add Document</Button></DialogTrigger>
          <DialogContent className="glass-strong max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing.id ? "Edit Document" : "New Document"}</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div>
                <Label>File (PDF / DOC / IMG, max 25 MB)</Label>
                <div className="mt-2 flex items-center gap-4">
                  <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-white/10 bg-gradient-to-br from-primary/30 via-accent/20 to-primary/10">
                    <FileText className="h-7 w-7 text-white/80" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10">
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      {uploading ? "Uploading…" : editing.file_path ? "Replace file" : "Upload file"}
                      <input type="file" accept=".pdf,.doc,.docx,image/*" className="hidden" disabled={uploading}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ""; }} />
                    </label>
                    {editing.file_path && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="truncate max-w-[10rem]">{editing.file_path}</span>
                        <Button type="button" variant="ghost" size="sm" onClick={clearFile} className="h-6 text-rose-400 hover:text-rose-300">
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div><Label>Title</Label><Input value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
              <div><Label>Category</Label><Input value={editing.category ?? ""} onChange={(e) => setEditing({ ...editing, category: e.target.value })} placeholder="Policy / Agreement / Compliance" /></div>
              <div><Label>Description</Label><Textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Sort</Label><Input type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} /></div>
                <div className="flex items-end gap-2"><Switch checked={editing.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} /><Label>Active</Label></div>
              </div>
            </div>
            <DialogFooter><Button onClick={save} disabled={saving || uploading} className="gradient-primary text-white">{saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : editing.id ? "Update" : "Create"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      ) : undefined}
    >
      <div className="mb-6 relative max-w-lg">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search documents…" className="glass h-12 rounded-2xl pl-11 text-base" />
      </div>
      {filtered.length === 0 && (
        <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
          <Scale className="mx-auto mb-2 h-8 w-8 opacity-40" />No documents yet.
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((d, i) => (
          <motion.div key={d.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
            className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-5 hover:border-primary/50 transition-all">
            <div className="flex items-start gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary/30 via-accent/20 to-primary/10 border border-white/10">
                <FileText className="h-7 w-7 text-white/90" />
              </div>
              <div className="min-w-0 flex-1">
                {d.category && <Badge variant="outline" className="mb-1.5 border-primary/30 bg-primary/10 text-primary text-[10px]">{d.category}</Badge>}
                <div className="truncate font-bold">{d.title}</div>
                {d.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{d.description}</p>}
                <div className="mt-1 text-[11px] text-muted-foreground">{humanSize(d.file_size)}{!d.is_active && " • Hidden"}</div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/10 pt-3">
              <Button size="sm" onClick={() => openDoc(d)} disabled={previewLoading} className="gradient-primary text-white h-9">
                {previewLoading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Eye className="mr-1.5 h-4 w-4" />}Open
              </Button>
              {isAdmin && (
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => { setEditing(d); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => remove(d)}><Trash2 className="h-4 w-4 text-rose-400" /></Button>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      <Dialog open={!!preview} onOpenChange={(v) => { if (!v) setPreview(null); }}>
        <DialogContent className="glass-strong max-w-5xl w-[95vw] h-[90vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="px-5 py-3 border-b border-white/10">
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-primary" />
              <span className="truncate">{preview?.doc.title}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 bg-black/40">
            {preview && (
              isImage(preview.doc.file_type) ? (
                <div className="h-full w-full overflow-auto grid place-items-center p-4">
                  <img src={preview.url} alt={preview.doc.title} className="max-h-full max-w-full object-contain rounded-lg" />
                </div>
              ) : isPdf(preview.doc.file_type, preview.doc.file_path) ? (
                <iframe src={preview.url} title={preview.doc.title} className="h-full w-full bg-white" />
              ) : (
                <div className="h-full grid place-items-center text-center p-6 text-muted-foreground">
                  <div>
                    <FileText className="mx-auto mb-3 h-10 w-10 opacity-50" />
                    <div className="text-sm">Preview not supported for this file type.</div>
                    <div className="text-xs mt-1">Use Download or Open in new tab.</div>
                  </div>
                </div>
              )
            )}
          </div>
          <DialogFooter className="px-5 py-3 border-t border-white/10 gap-2 sm:justify-between">
            <div className="text-xs text-muted-foreground truncate">{preview?.doc.description}</div>
            <div className="flex gap-2">
              {preview && (
                <>
                  <Button variant="outline" size="sm" onClick={() => window.open(preview.url, "_blank")}>
                    <ExternalLink className="mr-1.5 h-4 w-4" />New tab
                  </Button>
                  <a href={preview.url} download={preview.doc.title}>
                    <Button size="sm" className="gradient-primary text-white">
                      <Download className="mr-1.5 h-4 w-4" />Download
                    </Button>
                  </a>
                </>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}