import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Megaphone, Pin, PinOff, Plus, Trash2, Paperclip, X, Loader2, Edit3, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { logActivity } from "@/lib/activity-log";

export const Route = createFileRoute("/_app/announcements")({
  component: AnnouncementsPage,
});

type Attachment = { path: string; name: string; type: string; size: number };
type Priority = "low" | "normal" | "high" | "urgent";

type Announcement = {
  id: string;
  title: string;
  body: string;
  priority: Priority;
  pinned: boolean;
  scheduled_for: string | null;
  published_at: string | null;
  attachments: Attachment[];
  created_by: string | null;
  created_at: string;
};

const PRIORITY_STYLES: Record<Priority, string> = {
  low: "bg-white/5 border-white/10",
  normal: "bg-primary/10 border-primary/20 text-primary",
  high: "bg-orange-500/10 border-orange-500/30 text-orange-300",
  urgent: "bg-red-500/10 border-red-500/30 text-red-300",
};

function AnnouncementsPage() {
  const { role, user } = useAuth();
  const isAdmin = role === "admin";
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [toDelete, setToDelete] = useState<Announcement | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false });
      if (!alive) return;
      if (error) toast.error(error.message);
      setItems(((data ?? []) as unknown) as Announcement[]);
      setLoading(false);
    }
    load();
    const ch = supabase
      .channel("announcements_feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, (p) => {
        setItems((prev) => {
          if (p.eventType === "DELETE") return prev.filter((x) => x.id !== (p.old as { id: string }).id);
          const row = (p.new as unknown) as Announcement;
          const rest = prev.filter((x) => x.id !== row.id);
          const merged = [row, ...rest];
          merged.sort((a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });
          if (p.eventType === "INSERT" && row.created_by !== user?.id) {
            toast.info(`📣 ${row.title}`);
          }
          return merged;
        });
      })
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, [user?.id]);

  // Sign attachment URLs on demand
  useEffect(() => {
    const paths = items.flatMap((i) => (i.attachments ?? []).map((a) => a.path)).filter((p) => !signedUrls[p]);
    if (!paths.length) return;
    supabase.storage.from("announcements").createSignedUrls(paths, 60 * 60).then(({ data }) => {
      if (!data) return;
      setSignedUrls((prev) => {
        const next = { ...prev };
        data.forEach((s) => { if (s.signedUrl && s.path) next[s.path] = s.signedUrl; });
        return next;
      });
    });
  }, [items, signedUrls]);

  async function togglePin(a: Announcement) {
    const { error } = await supabase.from("announcements").update({ pinned: !a.pinned }).eq("id", a.id);
    if (error) return toast.error(error.message);
    toast.success(a.pinned ? "Unpinned" : "Pinned to top");
    logActivity({ action: a.pinned ? "unpin" : "pin", entity_type: "announcement", entity_id: a.id });
  }

  async function confirmDelete() {
    const a = toDelete;
    if (!a) return;
    setDeleting(true);
    const paths = (a.attachments ?? []).map((x) => x.path);
    if (paths.length) await supabase.storage.from("announcements").remove(paths);
    const { error } = await supabase.from("announcements").delete().eq("id", a.id);
    setDeleting(false);
    if (error) return toast.error(error.message);
    setItems((prev) => prev.filter((x) => x.id !== a.id));
    setToDelete(null);
    toast.success("Deleted");
    logActivity({ action: "delete", entity_type: "announcement", entity_id: a.id, metadata: { title: a.title } });
  }

  const now = new Date().toISOString();
  const visible = useMemo(
    () => items.filter((i) => isAdmin || (i.published_at && i.published_at <= now)),
    [items, isAdmin, now],
  );

  return (
    <PageShell
      title="Announcements"
      description={isAdmin ? "Broadcast news instantly to every HR" : "Latest updates from the team"}
      actions={
        isAdmin && (
          <Button onClick={() => { setEditing(null); setEditorOpen(true); }} className="gradient-primary text-white">
            <Plus className="h-4 w-4 mr-1" /> New
          </Button>
        )
      }
    >
      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : visible.length === 0 ? (
        <div className="glass rounded-2xl py-20 text-center text-muted-foreground">
          <Megaphone className="mx-auto mb-3 h-8 w-8 opacity-40" />
          No announcements yet.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <AnimatePresence initial={false}>
            {visible.map((a) => (
              <motion.article
                key={a.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`glass rounded-2xl p-5 relative overflow-hidden ${a.pinned ? "ring-1 ring-primary/40" : ""}`}
              >
                <div className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full gradient-accent opacity-20 blur-2xl" />
                <div className="relative z-10 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="grid h-10 w-10 place-items-center rounded-xl gradient-primary text-white shrink-0">
                      <Megaphone className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <Badge variant="outline" className={`text-[10px] ${PRIORITY_STYLES[a.priority]}`}>{a.priority}</Badge>
                      {a.pinned && (
                        <Badge variant="outline" className="ml-1 border-primary/30 bg-primary/10 text-primary text-[10px]">
                          <Pin className="h-2.5 w-2.5 mr-0.5" />pinned
                        </Badge>
                      )}
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="relative z-20 flex items-center gap-1">
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label={a.pinned ? "Unpin announcement" : "Pin announcement"} onClick={() => togglePin(a)}>
                        {a.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                      </Button>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label="Edit announcement" onClick={() => { setEditing(a); setEditorOpen(true); }}>
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" aria-label="Delete announcement" onClick={() => setToDelete(a)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
                <h3 className="mt-3 text-lg font-semibold">{a.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{a.body}</p>
                {a.attachments?.length > 0 && (() => {
                  const images = a.attachments.filter((x) => x.type.startsWith("image/"));
                  const videos = a.attachments.filter((x) => x.type.startsWith("video/"));
                  const files = a.attachments.filter((x) => !x.type.startsWith("image/") && !x.type.startsWith("video/"));
                  return (
                    <div className="mt-4 space-y-3">
                      {images.length > 0 && (
                        <div className={`grid gap-2 ${images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                          {images.map((att) => (
                            <a key={att.path} href={signedUrls[att.path]} target="_blank" rel="noreferrer"
                              className="group relative block overflow-hidden rounded-xl border border-white/10 bg-black/30">
                              {signedUrls[att.path] ? (
                                <img src={signedUrls[att.path]} alt={att.name}
                                  className="w-full h-auto max-h-[420px] object-contain transition group-hover:opacity-95" loading="lazy" />
                              ) : (
                                <div className="grid aspect-video place-items-center text-muted-foreground">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                </div>
                              )}
                            </a>
                          ))}
                        </div>
                      )}
                      {videos.map((att) => (
                        signedUrls[att.path] ? (
                          <video key={att.path} src={signedUrls[att.path]} controls
                            className="w-full rounded-xl border border-white/10 bg-black/40 max-h-[420px]" />
                        ) : null
                      ))}
                      {files.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {files.map((att) => (
                            <a key={att.path} href={signedUrls[att.path]} target="_blank" rel="noreferrer"
                              className="flex items-center gap-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 px-2.5 py-1.5 text-xs">
                              <FileText className="h-3.5 w-3.5" />
                              <span className="truncate max-w-[12rem]">{att.name}</span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
                <div className="mt-4 text-[11px] uppercase tracking-widest text-muted-foreground">
                  {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                  {a.scheduled_for && new Date(a.scheduled_for) > new Date() && (
                    <span className="ml-2 text-amber-300/80">scheduled</span>
                  )}
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </div>
      )}

      {isAdmin && (
        <AnnouncementEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          editing={editing}
          onSaved={() => setEditorOpen(false)}
        />
      )}
      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent className="glass-strong">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete announcement?</AlertDialogTitle>
            <AlertDialogDescription>
              "{toDelete?.title}" will be permanently removed for everyone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmDelete(); }} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}

function AnnouncementEditor({
  open, onOpenChange, editing, onSaved,
}: { open: boolean; onOpenChange: (v: boolean) => void; editing: Announcement | null; onSaved: () => void }) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [pinned, setPinned] = useState(false);
  const [scheduled, setScheduled] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTitle(editing.title); setBody(editing.body); setPriority(editing.priority);
      setPinned(editing.pinned);
      setScheduled(editing.scheduled_for ? new Date(editing.scheduled_for).toISOString().slice(0, 16) : "");
      setAttachments(editing.attachments ?? []);
    } else {
      setTitle(""); setBody(""); setPriority("normal"); setPinned(false); setScheduled(""); setAttachments([]);
    }
  }, [open, editing]);

  async function handleUpload(files: FileList | null) {
    if (!files?.length || !user) return;
    setUploading(true);
    const uploaded: Attachment[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 25 * 1024 * 1024) { toast.error(`${file.name} exceeds 25MB`); continue; }
      const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage.from("announcements").upload(path, file, { contentType: file.type });
      if (error) { toast.error(error.message); continue; }
      uploaded.push({ path, name: file.name, type: file.type, size: file.size });
    }
    setAttachments((p) => [...p, ...uploaded]);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function removeAttachment(att: Attachment) {
    await supabase.storage.from("announcements").remove([att.path]);
    setAttachments((p) => p.filter((a) => a.path !== att.path));
  }

  async function save() {
    if (!title.trim() || !body.trim()) return toast.error("Title and body are required");
    setSaving(true);
    const payload = {
      title: title.trim(),
      body: body.trim(),
      priority,
      pinned,
      scheduled_for: scheduled ? new Date(scheduled).toISOString() : null,
      published_at: scheduled ? new Date(scheduled).toISOString() : new Date().toISOString(),
      attachments: attachments as never,
    };
    if (editing) {
      const { error } = await supabase.from("announcements").update(payload).eq("id", editing.id);
      if (error) { setSaving(false); return toast.error(error.message); }
      toast.success("Updated");
      logActivity({ action: "update", entity_type: "announcement", entity_id: editing.id, metadata: { title } });
    } else {
      const { data, error } = await supabase
        .from("announcements")
        .insert({ ...payload, created_by: user?.id ?? null })
        .select("id")
        .single();
      if (error) { setSaving(false); return toast.error(error.message); }
      toast.success("Published to all HR");
      logActivity({ action: "create", entity_type: "announcement", entity_id: data.id, metadata: { title } });
    }
    setSaving(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl glass-strong">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit announcement" : "New announcement"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Big news…" />
          </div>
          <div>
            <Label>Body</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} placeholder="Write your announcement… (supports line breaks)" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Schedule (optional)</Label>
              <Input type="datetime-local" value={scheduled} onChange={(e) => setScheduled(e.target.value)} />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none glass rounded-xl px-3 py-2 w-full">
                <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="accent-primary" />
                Pin to top
              </label>
            </div>
          </div>
          <div>
            <Label>Attachments (images, PDFs, video — max 25MB each)</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {attachments.map((a) => (
                <div key={a.path} className="flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-xs">
                  <Paperclip className="h-3.5 w-3.5" />
                  <span className="truncate max-w-[8rem]">{a.name}</span>
                  <button type="button" onClick={() => removeAttachment(a)} className="text-muted-foreground hover:text-destructive">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <Button size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
                <span className="ml-1">Add</span>
              </Button>
              <input
                ref={fileRef} type="file" multiple hidden
                accept="image/*,application/pdf,video/*"
                onChange={(e) => handleUpload(e.target.files)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="gradient-primary text-white">
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {editing ? "Save changes" : scheduled ? "Schedule" : "Publish now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}