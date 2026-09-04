import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, Play, ExternalLink, Video, Search } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { logActivity } from "@/lib/activity-log";

type WorkVideo = {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  category: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type FormState = {
  id?: string;
  title: string;
  description: string;
  video_url: string;
  thumbnail_url: string;
  category: string;
  sort_order: number;
  is_active: boolean;
};

const EMPTY: FormState = {
  title: "",
  description: "",
  video_url: "",
  thumbnail_url: "",
  category: "",
  sort_order: 0,
  is_active: true,
};

function toEmbed(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
      if (u.pathname.startsWith("/embed/")) return url;
      if (u.pathname.startsWith("/shorts/")) return `https://www.youtube.com/embed/${u.pathname.split("/")[2]}`;
    }
    if (u.hostname === "youtu.be") {
      return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    }
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
    return url;
  } catch {
    return null;
  }
}

function ytThumb(url: string): string | null {
  try {
    const u = new URL(url);
    let id: string | null = null;
    if (u.hostname.includes("youtube.com")) id = u.searchParams.get("v") ?? (u.pathname.startsWith("/shorts/") ? u.pathname.split("/")[2] : null);
    if (u.hostname === "youtu.be") id = u.pathname.slice(1);
    return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
  } catch {
    return null;
  }
}

function WorkVideosPage() {
  const { role, loading } = useAuth();
  const isAdmin = role === "admin";
  const [videos, setVideos] = useState<WorkVideo[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState<WorkVideo | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data, error } = await (supabase as any)
      .from("work_videos")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      return;
    }
    setVideos((data as WorkVideo[]) ?? []);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("work_videos_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "work_videos" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return videos;
    return videos.filter(
      (v) =>
        v.title.toLowerCase().includes(q) ||
        (v.description ?? "").toLowerCase().includes(q) ||
        (v.category ?? "").toLowerCase().includes(q),
    );
  }, [videos, query]);

  function openNew() {
    setForm(EMPTY);
    setOpen(true);
  }
  function openEdit(v: WorkVideo) {
    setForm({
      id: v.id,
      title: v.title,
      description: v.description ?? "",
      video_url: v.video_url,
      thumbnail_url: v.thumbnail_url ?? "",
      category: v.category ?? "",
      sort_order: v.sort_order,
      is_active: v.is_active,
    });
    setOpen(true);
  }

  async function save() {
    if (!form.title.trim() || !form.video_url.trim()) {
      toast.error("Title and video/voice link are required");
      return;
    }
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      video_url: form.video_url.trim(),
      thumbnail_url: form.thumbnail_url.trim() || null,
      category: form.category.trim() || null,
      sort_order: Number(form.sort_order) || 0,
      is_active: form.is_active,
    };
    let error;
    if (form.id) {
      ({ error } = await (supabase as any).from("work_videos").update(payload).eq("id", form.id));
    } else {
      const { data: auth } = await supabase.auth.getUser();
      ({ error } = await (supabase as any).from("work_videos").insert({ ...payload, created_by: auth.user?.id }));
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(form.id ? "Video updated" : "Video added");
    logActivity({
      action: form.id ? "work_video.update" : "work_video.create",
      entity_type: "work_video",
      entity_id: form.id,
      metadata: { title: payload.title },
    });
    setOpen(false);
    setForm(EMPTY);
  }

  async function remove(v: WorkVideo) {
    if (!confirm(`Delete "${v.title}"?`)) return;
    const { error } = await (supabase as any).from("work_videos").delete().eq("id", v.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    logActivity({ action: "work_video.delete", entity_type: "work_video", entity_id: v.id, metadata: { title: v.title } });
  }

  async function toggleActive(v: WorkVideo) {
    const { error } = await (supabase as any).from("work_videos").update({ is_active: !v.is_active }).eq("id", v.id);
    if (error) return toast.error(error.message);
    logActivity({
      action: v.is_active ? "work_video.hide" : "work_video.publish",
      entity_type: "work_video",
      entity_id: v.id,
    });
  }

  if (loading) return <PageShell title="Work Videos"><div className="text-muted-foreground">Loading…</div></PageShell>;

  return (
    <PageShell
      title="Work Videos"
      description="Training videos & voice notes for the team"
      actions={
        isAdmin ? (
          <Button onClick={openNew} className="gradient-primary text-white">
            <Plus className="h-4 w-4 mr-1" /> Add Video
          </Button>
        ) : null
      }
    >
      <div className="mb-5 flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search title, category, description"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 glass border-white/10"
          />
        </div>
        <div className="text-xs text-muted-foreground">{filtered.length} video{filtered.length === 1 ? "" : "s"}</div>
      </div>

      {filtered.length === 0 ? (
        <div className="glass rounded-3xl p-12 text-center border border-white/5">
          <Video className="mx-auto h-10 w-10 text-muted-foreground/60 mb-3" />
          <div className="font-semibold">No videos yet</div>
          <div className="text-sm text-muted-foreground mt-1">
            {isAdmin ? "Click Add Video to publish your first training or voice link." : "Check back soon — admin will publish training videos here."}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((v) => {
            const thumb = v.thumbnail_url || ytThumb(v.video_url);
            return (
              <motion.div
                key={v.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass rounded-2xl overflow-hidden border border-white/10 group flex flex-col"
              >
                <button
                  onClick={() => setPlaying(v)}
                  className="relative aspect-video bg-black/40 flex items-center justify-center overflow-hidden"
                >
                  {thumb ? (
                    <img src={thumb} alt={v.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  ) : (
                    <Video className="h-10 w-10 text-white/40" />
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition grid place-items-center">
                    <div className="h-14 w-14 rounded-full gradient-primary grid place-items-center shadow-lg">
                      <Play className="h-6 w-6 text-white fill-white" />
                    </div>
                  </div>
                  {!v.is_active && (
                    <div className="absolute top-2 left-2 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-500/80 text-white">
                      Hidden
                    </div>
                  )}
                  {v.category && (
                    <div className="absolute top-2 right-2 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/60 text-white/90">
                      {v.category}
                    </div>
                  )}
                </button>
                <div className="p-4 flex-1 flex flex-col">
                  <div className="font-semibold line-clamp-1">{v.title}</div>
                  {v.description && (
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{v.description}</div>
                  )}
                  <div className="mt-3 flex items-center gap-2">
                    <Button size="sm" variant="secondary" className="flex-1" onClick={() => setPlaying(v)}>
                      <Play className="h-3.5 w-3.5 mr-1" /> Play
                    </Button>
                    <Button size="sm" variant="ghost" asChild>
                      <a href={v.video_url} target="_blank" rel="noreferrer" aria-label="Open in new tab">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                    {isAdmin && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(v)} aria-label="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => remove(v)} aria-label="Delete">
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </Button>
                      </>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Order: {v.sort_order}</span>
                      <label className="flex items-center gap-2">
                        <span>{v.is_active ? "Published" : "Hidden"}</span>
                        <Switch checked={v.is_active} onCheckedChange={() => toggleActive(v)} />
                      </label>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass border-white/10 max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Video" : "Add Video / Voice Link"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Title *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. How to open Groww account" />
            </div>
            <div className="grid gap-1.5">
              <Label>Video / Voice Link *</Label>
              <Input
                value={form.video_url}
                onChange={(e) => setForm({ ...form, video_url: e.target.value })}
                placeholder="YouTube, Vimeo, MP3/MP4 URL…"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Description</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Category</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Training, Pitch…" />
              </div>
              <div className="grid gap-1.5">
                <Label>Sort order</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Custom thumbnail URL (optional)</Label>
              <Input value={form.thumbnail_url} onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })} placeholder="https://…" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.is_active} onCheckedChange={(c) => setForm({ ...form, is_active: c })} />
              Published (visible to HR)
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="gradient-primary text-white" onClick={save} disabled={saving}>
              {saving ? "Saving…" : form.id ? "Save Changes" : "Add Video"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Player dialog */}
      <Dialog open={!!playing} onOpenChange={(o) => !o && setPlaying(null)}>
        <DialogContent className="glass border-white/10 max-w-3xl">
          <DialogHeader>
            <DialogTitle>{playing?.title}</DialogTitle>
          </DialogHeader>
          {playing && (() => {
            const embed = toEmbed(playing.video_url);
            const isAudio = /\.(mp3|wav|ogg|m4a)(\?|$)/i.test(playing.video_url);
            const isVideoFile = /\.(mp4|webm|mov)(\?|$)/i.test(playing.video_url);
            if (isAudio) {
              return <audio src={playing.video_url} controls autoPlay className="w-full" />;
            }
            if (isVideoFile) {
              return <video src={playing.video_url} controls autoPlay className="w-full rounded-lg aspect-video bg-black" />;
            }
            if (embed) {
              return (
                <div className="aspect-video">
                  <iframe
                    src={embed}
                    title={playing.title}
                    className="w-full h-full rounded-lg"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              );
            }
            return (
              <a href={playing.video_url} target="_blank" rel="noreferrer" className="text-primary underline">
                Open link
              </a>
            );
          })()}
          {playing?.description && (
            <div className="text-sm text-muted-foreground">{playing.description}</div>
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

export const Route = createFileRoute("/_app/work-videos")({
  component: WorkVideosPage,
});