import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, Send, Search, Megaphone, ArrowLeft, Loader2, Pencil, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type HR = { id: string; full_name: string; email: string; hr_code: string | null };
type Msg = {
  id: string;
  sender_id: string;
  recipient_id: string | null;
  broadcast_scope: string | null;
  body: string;
  created_at: string;
  edited_at: string | null;
};

const BROADCAST_ID = "__all_hrs__";

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function LiveChatWidget() {
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [hrs, setHrs] = useState<HR[]>([]);
  const [adminUser, setAdminUser] = useState<HR | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [search, setSearch] = useState("");
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load contact list
  useEffect(() => {
    if (!user) return;
    (async () => {
      if (isAdmin) {
        const { data } = await supabase
          .from("hr_profiles")
          .select("id,full_name,email,hr_code")
          .eq("status", "approved")
          .neq("id", user.id)
          .order("full_name");
        setHrs((data ?? []) as HR[]);
      } else {
        // HR sees admins
        const { data: roles } = await supabase
          .rpc("get_admin_user_ids");
        const adminIds = (roles ?? []).map((r: { user_id: string }) => r.user_id);
        if (adminIds.length) {
          const { data } = await supabase
            .from("hr_profiles")
            .select("id,full_name,email,hr_code")
            .in("id", adminIds);
          const first = (data ?? [])[0] as HR | undefined;
          if (first) setAdminUser(first);
        }
      }
    })();
  }, [user, isAdmin]);

  // Unread badge (messages to me in last day)
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      let count = 0;
      const { count: c1 } = await supabase
        .from("direct_messages")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", user.id)
        .is("read_at", null)
        .gte("created_at", since);
      count += c1 ?? 0;
      if (!isAdmin) {
        const { count: c2 } = await supabase
          .from("direct_messages")
          .select("id", { count: "exact", head: true })
          .eq("broadcast_scope", "all_hrs")
          .is("read_at", null)
          .gte("created_at", since);
        count += c2 ?? 0;
      }
      setUnread(count);
    };
    load();
    const ch = supabase
      .channel("dm_unread")
      .on("postgres_changes", { event: "*", schema: "public", table: "direct_messages" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, isAdmin]);

  // For HR: on open, redirect to full notifications page instead of chat
  useEffect(() => {
    if (open && !isAdmin) {
      setOpen(false);
      navigate({ to: "/broadcast" });
    }
  }, [open, isAdmin, navigate]);

  // Load messages for active thread
  useEffect(() => {
    if (!user || !activeId) {
      setMsgs([]);
      return;
    }
    const load = async () => {
      let q = supabase.from("direct_messages").select("*").order("created_at");
      if (activeId === BROADCAST_ID) {
        q = q.eq("broadcast_scope", "all_hrs");
      } else {
        q = q.or(
          `and(sender_id.eq.${user.id},recipient_id.eq.${activeId}),and(sender_id.eq.${activeId},recipient_id.eq.${user.id})`
        );
      }
      const { data } = await q;
      setMsgs((data ?? []) as Msg[]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      // mark read
      if (activeId !== BROADCAST_ID) {
        await supabase
          .from("direct_messages")
          .update({ read_at: new Date().toISOString() })
          .eq("recipient_id", user.id)
          .eq("sender_id", activeId)
          .is("read_at", null);
      }
    };
    load();
    const ch = supabase
      .channel(`dm_${activeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "direct_messages" },
        load
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, activeId]);

  const filteredHRs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return hrs;
    return hrs.filter(
      (h) =>
        h.full_name.toLowerCase().includes(q) ||
        h.email.toLowerCase().includes(q) ||
        (h.hr_code ?? "").toLowerCase().includes(q)
    );
  }, [hrs, search]);

  const send = async () => {
    if (!user || !activeId || !reply.trim()) return;
    setSending(true);
    const payload: {
      sender_id: string;
      body: string;
      recipient_id?: string;
      broadcast_scope?: string;
    } = { sender_id: user.id, body: reply.trim() };
    if (activeId === BROADCAST_ID) payload.broadcast_scope = "all_hrs";
    else payload.recipient_id = activeId;
    const { error } = await supabase.from("direct_messages").insert(payload);
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setReply("");
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
    if (!confirm("Delete this message?")) return;
    const { error } = await supabase.from("direct_messages").delete().eq("id", id);
    if (error) toast.error(error.message);
  };

  if (!user) return null;

  const activeName =
    activeId === BROADCAST_ID
      ? "All HRs (Broadcast)"
      : isAdmin
        ? hrs.find((h) => h.id === activeId)?.full_name ?? ""
        : adminUser?.full_name ?? "Admin";

  return (
    <>
      {/* Floating button */}
      <motion.button
        onClick={() => setOpen((v) => !v)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-5 right-5 z-50 grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-amber-400 via-pink-500 to-red-500 text-white ring-2 ring-amber-300/60 shadow-[0_0_28px_rgba(239,68,68,0.7)] hover:shadow-[0_0_40px_rgba(251,191,36,0.85)] transition-shadow"
        aria-label="Live Chat"
      >
        <span aria-hidden className="pointer-events-none absolute inset-0 rounded-full animate-spin [animation-duration:4s] p-[2px]" style={{ background: "conic-gradient(from 0deg, transparent 0deg, transparent 300deg, #fde68a 330deg, #ef4444 350deg, #fde68a 360deg)", WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)", WebkitMaskComposite: "xor", mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)", maskComposite: "exclude" }} />
        {open ? <X className="h-5 w-5 drop-shadow-[0_0_5px_rgba(255,255,255,0.9)]" strokeWidth={2.5} /> : <MessageSquare className="h-5 w-5 drop-shadow-[0_0_5px_rgba(255,255,255,0.9)]" strokeWidth={2.5} />}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 20, stiffness: 260 }}
            className="fixed bottom-24 right-5 z-50 flex h-[600px] max-h-[80vh] w-[92vw] max-w-md flex-col overflow-hidden rounded-2xl border border-primary/40 bg-background/95 shadow-[0_20px_60px_-10px_hsl(var(--primary)/0.6)] backdrop-blur-xl"
          >
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-border/60 bg-gradient-to-r from-primary/20 via-accent/10 to-transparent px-4 py-3">
              {isAdmin && activeId && (
                <button
                  onClick={() => setActiveId(null)}
                  className="grid h-8 w-8 place-items-center rounded-full bg-white/5 hover:bg-white/10"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-primary to-accent">
                <MessageSquare className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-base font-bold leading-tight">
                  {activeId ? activeName : "Live Chat"}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {activeId ? "Real-time messaging" : isAdmin ? "Message anyone instantly" : "Chat with admin"}
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-full bg-white/5 hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            {isAdmin && !activeId ? (
              <div className="flex-1 overflow-y-auto p-3">
                <div className="relative mb-3">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search people…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Broadcast
                </div>
                <button
                  onClick={() => {
                    setOpen(false);
                    navigate({ to: "/broadcast" });
                  }}
                  className="mb-4 flex w-full items-center gap-3 rounded-xl border border-primary/40 bg-gradient-to-r from-primary/15 to-accent/10 p-3 text-left transition hover:from-primary/25 hover:to-accent/20"
                >
                  <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-primary to-accent">
                    <Megaphone className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm font-bold">
                      All HRs
                      <Badge className="bg-primary/30 text-[10px]">GROUP</Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Broadcast to {hrs.length} HRs at once
                    </div>
                  </div>
                  <Megaphone className="h-4 w-4 text-primary" />
                </button>

                <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  People you can message
                </div>
                <div className="flex flex-col gap-1">
                  {filteredHRs.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => setActiveId(h.id)}
                      className="flex items-center gap-3 rounded-xl p-2.5 text-left transition hover:bg-white/5"
                    >
                      <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-primary/70 to-accent/70 text-sm font-bold text-primary-foreground">
                        {initials(h.full_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm font-semibold truncate">
                          {h.full_name}
                          <Badge variant="outline" className="text-[9px]">HR</Badge>
                        </div>
                        <div className="truncate text-[11px] text-muted-foreground">{h.email}</div>
                      </div>
                    </button>
                  ))}
                  {!filteredHRs.length && (
                    <div className="p-6 text-center text-sm text-muted-foreground">No people found.</div>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto space-y-2 p-3">
                  {msgs.length === 0 && (
                    <div className="grid h-full place-items-center text-center text-sm text-muted-foreground">
                      <div>
                        <MessageSquare className="mx-auto mb-2 h-8 w-8 opacity-40" />
                        Say hi 👋
                      </div>
                    </div>
                  )}
                  {msgs.map((m) => {
                    const mine = m.sender_id === user.id;
                    const canManage = mine || isAdmin;
                    return (
                      <div key={m.id} className={cn("group flex", mine ? "justify-end" : "justify-start")}>
                        <div
                          className={cn(
                            "relative max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                            mine
                              ? "bg-gradient-to-br from-primary to-accent text-primary-foreground"
                              : "bg-white/5 text-foreground"
                          )}
                        >
                          {editingId === m.id ? (
                            <div className="flex items-end gap-1">
                              <Textarea
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                className="min-h-[40px] w-56 bg-background/60 text-foreground"
                              />
                              <Button size="icon" className="h-8 w-8" onClick={() => saveEdit(m.id)}>
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingId(null)}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <div className="whitespace-pre-wrap break-words">{m.body}</div>
                              <div className={cn("mt-0.5 text-[10px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                                {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                {m.edited_at && " · edited"}
                              </div>
                              {canManage && (
                                <div className="absolute -top-3 right-1 hidden gap-1 group-hover:flex">
                                  <button
                                    onClick={() => {
                                      setEditingId(m.id);
                                      setEditText(m.body);
                                    }}
                                    className="grid h-6 w-6 place-items-center rounded-full bg-background shadow ring-1 ring-border"
                                    aria-label="Edit"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={() => remove(m.id)}
                                    className="grid h-6 w-6 place-items-center rounded-full bg-background shadow ring-1 ring-border text-destructive"
                                    aria-label="Delete"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>

                <div className="border-t border-border/60 bg-background/60 p-2">
                  <div className="flex items-end gap-2">
                    <Textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          send();
                        }
                      }}
                      placeholder="Type a message…"
                      className="min-h-[42px] max-h-32 resize-none"
                    />
                    <Button onClick={send} disabled={sending || !reply.trim()} size="icon" className="h-10 w-10 shrink-0">
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}