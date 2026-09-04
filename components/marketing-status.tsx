import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Megaphone,
  Plus,
  Pencil,
  Trash2,
  Upload,
  Loader2,
  Play,
  Pause,
  X,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Video as VideoIcon,
  ExternalLink,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { logActivity } from "@/lib/activity-log";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

type Status = {
  id: string;
  media_url: string;
  media_type: string;
  title: string | null;
  caption: string | null;
  link_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

const empty: Partial<Status> = {
  media_url: "",
  media_type: "image",
  title: "",
  caption: "",
  link_url: "",
  is_active: true,
  sort_order: 0,
};

function useSignedUrl(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!path) { setUrl(null); return; }
    if (/^https?:\/\//i.test(path) || path.startsWith("data:")) { setUrl(path); return; }
    supabase.storage.from("marketing-status").createSignedUrl(path, 60 * 60).then(({ data }) => {
      if (!cancelled) setUrl(data?.signedUrl ?? null);
    });
    return () => { cancelled = true; };
  }, [path]);
  return url;
}

function StatusMedia({ item, className }: { item: Status; className?: string }) {
  const url = useSignedUrl(item.media_url);
  if (!url) {
    return (
      <div className={cn("grid h-full w-full place-items-center bg-gradient-to-br from-primary/30 to-accent/20", className)}>
        <Loader2 className="h-6 w-6 animate-spin text-white/70" />
      </div>
    );
  }
  if (item.media_type === "video") {
    return (
      <video
        src={url}
        className={cn("h-full w-full object-cover", className)}
        controls
        playsInline
        preload="metadata"
      />
    );
  }
  return <img src={url} alt={item.title ?? "Status"} className={cn("h-full w-full object-cover", className)} loading="lazy" />;
}

async function downloadStatusMedia(item: Status) {
  try {
    let url: string | null = null;
    if (/^https?:\/\//i.test(item.media_url) || item.media_url.startsWith("data:")) {
      url = item.media_url;
    } else {
      const { data, error } = await supabase.storage
        .from("marketing-status")
        .createSignedUrl(item.media_url, 60 * 60, { download: true });
      if (error) throw error;
      url = data?.signedUrl ?? null;
    }
    if (!url) throw new Error("Unable to prepare download");
    const res = await fetch(url);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const ext = (item.media_url.split(".").pop() || (item.media_type === "video" ? "mp4" : "jpg")).split("?")[0];
    const safeTitle = (item.title || "status").replace(/[^\w\-]+/g, "_").slice(0, 40);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = `${safeTitle}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    toast.success("Download started");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Download failed";
    toast.error(msg);
  }
}

export function MarketingStatus() {
  const { role, user } = useAuth();
  const isAdmin = role === "admin";
  const [items, setItems] = useState<Status[]>([]);
  const [active, setActive] = useState<Status | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Status>>(empty);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [toDelete, setToDelete] = useState<Status | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("marketing_status")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    setItems(((data ?? []) as unknown) as Status[]);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("marketing_status_feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "marketing_status" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const visible = useMemo(
    () => (isAdmin ? items : items.filter((i) => i.is_active)),
    [items, isAdmin],
  );

  const openNew = () => { setEditing({ ...empty }); setDialogOpen(true); };
  const openEdit = (s: Status) => { setEditing(s); setDialogOpen(true); };

  const uploadFile = async (file: File) => {
    if (!file) return;
    const isVideo = file.type.startsWith("video/");
    const maxMb = isVideo ? 50 : 10;
    if (file.size > maxMb * 1024 * 1024) {
      toast.error(`${isVideo ? "Video" : "Image"} must be under ${maxMb} MB`);
      return;
    }
    setUploading(true);
    const ext = (file.name.split(".").pop() || (isVideo ? "mp4" : "png")).toLowerCase();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("marketing-status")
      .upload(path, file, { contentType: file.type, upsert: false });
    setUploading(false);
    if (error) return toast.error(error.message);
    setEditing((prev) => ({ ...prev, media_url: path, media_type: isVideo ? "video" : "image" }));
    toast.success("Media uploaded");
  };

  const save = async () => {
    if (!editing.media_url) { toast.error("Please upload a banner, poster or reel"); return; }
    const payload = {
      media_url: editing.media_url!,
      media_type: editing.media_type || "image",
      title: editing.title || null,
      caption: editing.caption || null,
      link_url: editing.link_url || null,
      is_active: editing.is_active ?? true,
      sort_order: Number(editing.sort_order ?? 0),
      created_by: user?.id ?? null,
    };
    if (editing.id) {
      const { error } = await supabase.from("marketing_status").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      await logActivity({ action: "update", entity_type: "marketing_status", entity_id: editing.id });
      toast.success("Status updated");
    } else {
      const { data, error } = await supabase.from("marketing_status").insert(payload).select("id").single();
      if (error) return toast.error(error.message);
      await logActivity({ action: "create", entity_type: "marketing_status", entity_id: data?.id ?? null });
      toast.success("Status published");
    }
    setDialogOpen(false);
    setEditing(empty);
    load();
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    const s = toDelete;
    const { error } = await supabase.from("marketing_status").delete().eq("id", s.id);
    if (error) {
      setDeleting(false);
      toast.error(error.message);
      return;
    }
    if (s.media_url && !/^https?:\/\//i.test(s.media_url)) {
      await supabase.storage.from("marketing-status").remove([s.media_url]);
    }
    await logActivity({ action: "delete", entity_type: "marketing_status", entity_id: s.id });
    toast.success("Deleted");
    setDeleting(false);
    setToDelete(null);
    load();
  };

  const scroll = (dir: 1 | -1) => {
    scrollerRef.current?.scrollBy({ left: dir * 340, behavior: "smooth" });
  };

  if (!isAdmin && visible.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative mt-6 overflow-hidden rounded-3xl p-[1.5px]"
    >
      {/* Animated glowing ring */}
      <div className="absolute inset-0 rounded-3xl bg-[conic-gradient(from_0deg,hsl(var(--primary)),hsl(var(--accent)),#f472b6,#facc15,hsl(var(--primary)))] opacity-80 animate-[spin_10s_linear_infinite]" />
      <div className="relative rounded-[calc(1.5rem-1.5px)] bg-gradient-to-br from-background/95 via-background/80 to-background/95 backdrop-blur-xl">
        <div className="pointer-events-none absolute -top-24 -right-16 h-56 w-56 rounded-full bg-primary/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-accent/25 blur-3xl" />

        <div className="relative p-5 sm:p-6">
          {/* Header */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl gradient-primary text-white shadow-[0_15px_35px_-10px_hsl(var(--primary)/0.7)]">
                <Megaphone className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg sm:text-xl font-black tracking-tight">Status Marketing</h3>
                  <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary">
                    <Sparkles className="h-3 w-3" /> Highlight
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Fresh banners, posters and reels from the team</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {visible.length > 2 && (
                <>
                  <Button size="icon" variant="outline" onClick={() => scroll(-1)} className="h-9 w-9 rounded-full">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="outline" onClick={() => scroll(1)} className="h-9 w-9 rounded-full">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}
              {isAdmin && (
                <Button onClick={openNew} className="gradient-primary text-white">
                  <Plus className="mr-1 h-4 w-4" /> Add
                </Button>
              )}
            </div>
          </div>

          {/* Empty state (admin only, since HR is short-circuited above) */}
          {visible.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No status yet. Share a banner, poster or reel to spotlight it here.
              </p>
            </div>
          )}

          {/* Horizontal reel */}
          {visible.length > 0 && (
            <div
              ref={scrollerRef}
              className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {visible.map((s) => (
                <StatusCard
                  key={s.id}
                  status={s}
                  isAdmin={isAdmin}
                  onOpen={() => setActive(s)}
                  onEdit={() => openEdit(s)}
                  onDelete={() => setToDelete(s)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen viewer */}
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] grid place-items-center bg-black/85 backdrop-blur-md p-4"
            onClick={() => setActive(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-background/90 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setActive(null)}
                className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white hover:bg-black/70"
              >
                <X className="h-4 w-4" />
              </button>
              <button
                onClick={() => downloadStatusMedia(active)}
                className="absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-primary/90 px-3 py-1.5 text-xs font-semibold text-white shadow-lg hover:bg-primary"
              >
                <Download className="h-3.5 w-3.5" /> Download
              </button>
              <div className="aspect-[9/12] w-full bg-black">
                <StatusMedia item={active} />
              </div>
              {(active.title || active.caption || active.link_url) && (
                <div className="space-y-2 p-5">
                  {active.title && <h4 className="text-lg font-bold">{active.title}</h4>}
                  {active.caption && (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{active.caption}</p>
                  )}
                  {active.link_url && (
                    <a
                      href={active.link_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                    >
                      Open link <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin editor */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing.id ? "Edit status" : "New status"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Media (banner / poster / reel)</Label>
              <div className="mt-2 flex items-center gap-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,video/*"
                  hidden
                  onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])}
                />
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  {editing.media_url ? "Replace" : "Upload"}
                </Button>
                {editing.media_url && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    {editing.media_type === "video" ? <VideoIcon className="h-3.5 w-3.5" /> : <ImageIcon className="h-3.5 w-3.5" />}
                    {editing.media_type}
                  </span>
                )}
              </div>
              {editing.media_url && (
                <div className="mt-3 aspect-[9/12] w-40 overflow-hidden rounded-xl border border-white/10 bg-black">
                  <StatusMedia item={editing as Status} />
                </div>
              )}
              <p className="mt-1.5 text-[11px] text-muted-foreground">Images up to 10 MB · Videos up to 50 MB</p>
            </div>
            <div>
              <Label>Title (optional)</Label>
              <Input
                value={editing.title ?? ""}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                placeholder="Diwali offer poster"
              />
            </div>
            <div>
              <Label>Caption (optional)</Label>
              <Textarea
                rows={3}
                value={editing.caption ?? ""}
                onChange={(e) => setEditing({ ...editing, caption: e.target.value })}
                placeholder="Share this with your leads today"
              />
            </div>
            <div>
              <Label>Link (optional)</Label>
              <Input
                value={editing.link_url ?? ""}
                onChange={(e) => setEditing({ ...editing, link_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Sort order</Label>
                <Input
                  type="number"
                  value={editing.sort_order ?? 0}
                  onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })}
                />
              </div>
              <div className="flex items-end gap-2">
                <Switch
                  checked={editing.is_active ?? true}
                  onCheckedChange={(v) => setEditing({ ...editing, is_active: v })}
                />
                <span className="pb-1 text-sm">Active</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} className="gradient-primary text-white">
              {editing.id ? "Save" : "Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && !deleting && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this status?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the banner, poster or reel. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => { e.preventDefault(); confirmDelete(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.section>
  );
}

function StatusCard({
  status,
  isAdmin,
  onOpen,
  onEdit,
  onDelete,
}: {
  status: Status;
  isAdmin: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  return (
    <motion.div
      whileHover={{ y: -4 }}
      className={cn(
        "group relative flex-shrink-0 snap-start overflow-hidden rounded-2xl border border-white/10 bg-black shadow-lg",
        "w-[210px] sm:w-[240px] aspect-[9/12]",
        !status.is_active && "opacity-60",
      )}
    >
      <button onClick={onOpen} className="absolute inset-0 z-[1]" aria-label="Open status" />
      <StatusMedia item={status} />

      {/* Overlay */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3">
        {status.title && (
          <div className="text-sm font-bold text-white line-clamp-1">{status.title}</div>
        )}
        {status.caption && (
          <div className="text-[11px] text-white/70 line-clamp-2">{status.caption}</div>
        )}
      </div>

      {/* Type chip */}
      <div className="pointer-events-none absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-white backdrop-blur">
        {status.media_type === "video" ? <VideoIcon className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
        {status.media_type}
      </div>

      {status.media_type === "video" && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-white/20 backdrop-blur-md">
            {playing ? <Pause className="h-5 w-5 text-white" /> : <Play className="h-5 w-5 text-white" />}
          </div>
        </div>
      )}

      {!status.is_active && (
        <div className="pointer-events-none absolute right-2 top-2 rounded-full bg-red-500/80 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
          Hidden
        </div>
      )}

      {isAdmin && (
        <div className="absolute right-2 bottom-2 z-[5] flex gap-1">
          <button
            type="button"
            aria-label="Download status"
            onClick={(e) => { e.stopPropagation(); downloadStatusMedia(status); }}
            className="grid h-8 w-8 place-items-center rounded-full bg-primary/90 text-white hover:bg-primary"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Edit status"
            onClick={(e) => { e.stopPropagation(); onEdit(); setPlaying(false); }}
            className="grid h-8 w-8 place-items-center rounded-full bg-black/70 text-white hover:bg-black/90"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Delete status"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="grid h-8 w-8 place-items-center rounded-full bg-red-500/80 text-white hover:bg-red-500"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {!isAdmin && (
        <div className="absolute right-2 bottom-2 z-[5]">
          <button
            type="button"
            aria-label="Download status"
            onClick={(e) => { e.stopPropagation(); downloadStatusMedia(status); }}
            className="inline-flex items-center gap-1 rounded-full bg-primary/90 px-2.5 py-1 text-[11px] font-semibold text-white shadow-md hover:bg-primary"
          >
            <Download className="h-3 w-3" /> Save
          </button>
        </div>
      )}
    </motion.div>
  );
}