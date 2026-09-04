import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Megaphone, Send, Users, Loader2, Bell, Sparkles, Pencil, Trash2, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/broadcast")({
  component: BroadcastPage,
});

type Msg = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  broadcast_scope: string | null;
};

function timeAgo(iso: string) {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
}

function BroadcastPage() {
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [hrCount, setHrCount] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase
      .from("hr_profiles")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved")
      .then(({ count }) => setHrCount(count ?? 0));
  }, []);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("direct_messages")
        .select("*")
        .eq("broadcast_scope", "all_hrs")
        .order("created_at", { ascending: false })
        .limit(200);
      setMsgs((data ?? []) as Msg[]);
      setLoading(false);
      // mark all as read for this user by upserting read markers via update — broadcast has no per-user read, so just clear the count via last-seen
      localStorage.setItem("broadcast_last_seen", new Date().toISOString());
    };
    load();
    const ch = supabase
      .channel("broadcast_page")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "direct_messages", filter: "broadcast_scope=eq.all_hrs" },
        load,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user]);

  const send = async () => {
    if (!user || !body.trim()) return;
    setSending(true);
    const { error } = await supabase.from("direct_messages").insert({
      sender_id: user.id,
      broadcast_scope: "all_hrs",
      body: body.trim(),
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setBody("");
    toast.success(`Sent to ${hrCount} HRs`);
    listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveEdit = async (id: string) => {
    if (!editText.trim()) return;
    const { error } = await supabase
      .from("direct_messages")
      .update({ body: editText.trim(), edited_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error(error.message);
    setEditingId(null);
    setEditText("");
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this notification for everyone?")) return;
    const { error } = await supabase.from("direct_messages").delete().eq("id", id);
    if (error) toast.error(error.message);
  };

  const grouped = useMemo(() => {
    const groups: Record<string, Msg[]> = {};
    msgs.forEach((m) => {
      const key = new Date(m.created_at).toLocaleDateString([], {
        weekday: "long",
        day: "numeric",
        month: "short",
      });
      (groups[key] ??= []).push(m);
    });
    return groups;
  }, [msgs]);

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.15),transparent_60%)]">
      {/* Premium hero */}
      <div className="relative overflow-hidden border-b border-border/60">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-pink-500/10 to-red-500/10" />
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(600px circle at 20% 20%, rgba(251,191,36,0.25), transparent 40%), radial-gradient(500px circle at 80% 60%, rgba(239,68,68,0.25), transparent 45%)",
          }}
        />
        <div className="relative mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-amber-400 via-pink-500 to-red-500 opacity-70 blur-lg" />
              <div className="relative grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 via-pink-500 to-red-500 shadow-[0_0_30px_rgba(239,68,68,0.6)]">
                <Megaphone className="h-7 w-7 text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.9)]" strokeWidth={2.5} />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight bg-gradient-to-r from-amber-300 via-pink-400 to-red-400 bg-clip-text text-transparent">
                  Admin Notifications
                </h1>
                <Badge className="bg-gradient-to-r from-amber-400 to-red-500 text-white border-0 shadow-[0_0_12px_rgba(239,68,68,0.6)]">
                  <Sparkles className="mr-1 h-3 w-3" /> Premium
                </Badge>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> {hrCount} approved HRs receiving
                </span>
                <span className="inline-flex items-center gap-1">
                  <Bell className="h-3.5 w-3.5 text-amber-300" /> Real-time delivery
                </span>
              </div>
            </div>
          </div>

          {/* Composer (admin only) */}
          {isAdmin && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 relative rounded-2xl p-[1.5px] bg-gradient-to-r from-amber-400/60 via-pink-500/60 to-red-500/60 shadow-[0_0_25px_rgba(239,68,68,0.25)]"
            >
              <div className="rounded-2xl bg-background/90 backdrop-blur-xl p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Broadcast to all HRs
                  </div>
                  <div className="text-[10px] text-muted-foreground">Only admin can send</div>
                </div>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Good morning team… write your announcement"
                  className="min-h-[90px] resize-none border-white/10 bg-white/5 focus-visible:ring-amber-400/40"
                />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="text-[11px] text-muted-foreground">
                    Delivers instantly to every approved HR — new HRs also see this history.
                  </div>
                  <Button
                    onClick={send}
                    disabled={!body.trim() || sending}
                    className="gap-2 bg-gradient-to-r from-amber-400 via-pink-500 to-red-500 text-white border-0 shadow-[0_0_20px_rgba(239,68,68,0.5)] hover:shadow-[0_0_30px_rgba(251,191,36,0.7)]"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Send Broadcast
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {!isAdmin && (
            <div className="mt-6 rounded-xl border border-amber-400/30 bg-amber-400/5 px-4 py-3 text-xs text-amber-200">
              You will receive announcements from the admin here. Notifications are read-only.
            </div>
          )}
        </div>
      </div>

      {/* Feed */}
      <div ref={listRef} className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        {loading ? (
          <div className="grid place-items-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : msgs.length === 0 ? (
          <div className="mx-auto max-w-md rounded-2xl border border-border/60 bg-background/60 p-10 text-center backdrop-blur-xl">
            <Bell className="mx-auto mb-3 h-10 w-10 opacity-40" />
            <div className="text-sm text-muted-foreground">
              No notifications yet. {isAdmin ? "Send the first announcement above." : "You'll see admin messages here."}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <AnimatePresence initial={false}>
              {Object.entries(grouped).map(([day, items]) => (
                <div key={day}>
                  <div className="mb-2 flex items-center gap-3">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      {day}
                    </div>
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
                  </div>
                  <div className="space-y-3">
                    {items.map((m) => {
                      const mine = m.sender_id === user?.id;
                      const canManage = isAdmin;
                      return (
                        <motion.div
                          key={m.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="group relative rounded-2xl p-[1.5px] bg-gradient-to-r from-amber-400/40 via-pink-500/40 to-red-500/40 hover:from-amber-400/70 hover:via-pink-500/70 hover:to-red-500/70 transition-colors"
                        >
                          <div className="rounded-2xl bg-background/85 backdrop-blur-xl p-4">
                            <div className="flex items-start gap-3">
                              <div className="relative shrink-0">
                                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-400 to-red-500 blur-md opacity-60" />
                                <div className="relative grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-amber-400 via-pink-500 to-red-500">
                                  <Megaphone className="h-5 w-5 text-white" strokeWidth={2.5} />
                                </div>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-bold">Admin</span>
                                  <Badge className="bg-red-500/20 text-red-300 border-red-500/30 text-[9px]">
                                    ADMIN
                                  </Badge>
                                  <Badge variant="outline" className="text-[9px]">
                                    All HRs
                                  </Badge>
                                  <span className="ml-auto text-[11px] text-muted-foreground">
                                    {timeAgo(m.created_at)}
                                    {m.edited_at && " · edited"}
                                  </span>
                                </div>
                                {editingId === m.id ? (
                                  <div className="mt-2 flex flex-col gap-2">
                                    <Textarea
                                      value={editText}
                                      onChange={(e) => setEditText(e.target.value)}
                                      className="min-h-[70px]"
                                    />
                                    <div className="flex gap-2">
                                      <Button size="sm" onClick={() => saveEdit(m.id)} className="gap-1">
                                        <Check className="h-3.5 w-3.5" /> Save
                                      </Button>
                                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className={cn("mt-1 whitespace-pre-wrap break-words text-sm", mine ? "text-foreground" : "text-foreground/90")}>
                                    {m.body}
                                  </div>
                                )}
                              </div>
                              {canManage && editingId !== m.id && (
                                <div className="flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                  <button
                                    onClick={() => {
                                      setEditingId(m.id);
                                      setEditText(m.body);
                                    }}
                                    className="grid h-7 w-7 place-items-center rounded-full bg-white/5 hover:bg-white/10"
                                    aria-label="Edit"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => remove(m.id)}
                                    className="grid h-7 w-7 place-items-center rounded-full bg-white/5 hover:bg-white/10 text-destructive"
                                    aria-label="Delete"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}