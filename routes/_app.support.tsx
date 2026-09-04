import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Send, MessageSquare, CheckCircle2, RotateCcw, Paperclip, X, Pencil, Trash2, Loader2, FileText, Download, Check, Sparkles, Headphones } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { logActivity } from "@/lib/activity-log";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/support")({ component: SupportPage });

type Ticket = { id: string; user_id: string; subject: string; category: string | null; priority: string; status: string; last_message_at: string; created_at: string };
type Attachment = { path: string; name: string; type: string; size: number };
type Message = { id: string; ticket_id: string; sender_id: string; sender_role: string; body: string; created_at: string; attachments: Attachment[]; edited_at: string | null };

function SupportPage() {
  const { role, user } = useAuth();
  const isAdmin = role === "admin";
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [pending, setPending] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const [openNew, setOpenNew] = useState(false);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("general");
  const [priority, setPriority] = useState("normal");
  const [body, setBody] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      let q = supabase.from("support_tickets").select("*").order("last_message_at", { ascending: false });
      if (!isAdmin && user) q = q.eq("user_id", user.id);
      const { data } = await q;
      const list = (data ?? []) as Ticket[];
      setTickets(list);
      if (isAdmin && list.length) {
        const ids = Array.from(new Set(list.map(t => t.user_id)));
        const { data: pp } = await supabase.from("hr_profiles").select("id,full_name").in("id", ids);
        setProfiles(Object.fromEntries((pp ?? []).map((p: { id: string; full_name: string }) => [p.id, p.full_name])));
      }
      if (!activeId && list[0]) setActiveId(list[0].id);
    };
    load();
    const ch = supabase.channel("tickets_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isAdmin, user, activeId]);

  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    const load = async () => {
      const { data } = await supabase.from("support_messages").select("*").eq("ticket_id", activeId).order("created_at");
      setMessages((data ?? []) as Message[]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    };
    load();
    const ch = supabase.channel(`msgs_${activeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_messages", filter: `ticket_id=eq.${activeId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeId]);

  // Sign attachment URLs on demand
  useEffect(() => {
    const paths = messages.flatMap(m => (m.attachments ?? []).map(a => a.path)).filter(p => !signedUrls[p]);
    if (!paths.length) return;
    supabase.storage.from("support-attachments").createSignedUrls(paths, 60 * 60).then(({ data }) => {
      if (!data) return;
      setSignedUrls(prev => {
        const next = { ...prev };
        data.forEach(s => { if (s.signedUrl && s.path) next[s.path] = s.signedUrl; });
        return next;
      });
    });
  }, [messages, signedUrls]);

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length || !user) return;
    setUploading(true);
    const uploaded: Attachment[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 25 * 1024 * 1024) { toast.error(`${file.name} exceeds 25MB`); continue; }
      const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage.from("support-attachments").upload(path, file, { contentType: file.type });
      if (error) { toast.error(error.message); continue; }
      uploaded.push({ path, name: file.name, type: file.type, size: file.size });
    }
    setPending(p => [...p, ...uploaded]);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removePending = async (att: Attachment) => {
    await supabase.storage.from("support-attachments").remove([att.path]);
    setPending(p => p.filter(a => a.path !== att.path));
  };

  const createTicket = async () => {
    if (!subject || !body || !user) return toast.error("Subject and message required");
    const { data: t, error } = await supabase.from("support_tickets").insert({ user_id: user.id, subject, category, priority }).select().single();
    if (error || !t) return toast.error(error?.message ?? "Failed");
    await supabase.from("support_messages").insert({ ticket_id: t.id, sender_id: user.id, sender_role: "hr", body });
    await logActivity({ action: "create", entity_type: "support_ticket", entity_id: t.id });
    toast.success("Ticket created");
    setOpenNew(false); setSubject(""); setBody(""); setActiveId(t.id);
  };

  const send = async () => {
    if ((!reply.trim() && pending.length === 0) || !activeId || !user) return;
    const { error } = await supabase.from("support_messages").insert({
      ticket_id: activeId,
      sender_id: user.id,
      sender_role: isAdmin ? "admin" : "hr",
      body: reply.trim() || (pending.length ? `📎 ${pending.length} attachment${pending.length > 1 ? "s" : ""}` : ""),
      attachments: pending as unknown as never,
    });
    if (error) return toast.error(error.message);
    await supabase.from("support_tickets").update({ last_message_at: new Date().toISOString() }).eq("id", activeId);
    setReply(""); setPending([]);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const { error } = await supabase.from("support_messages")
      .update({ body: editingText.trim(), edited_at: new Date().toISOString() })
      .eq("id", editingId);
    if (error) return toast.error(error.message);
    await logActivity({ action: "edit", entity_type: "support_message", entity_id: editingId });
    toast.success("Message updated");
    setEditingId(null); setEditingText("");
  };

  const deleteMessage = async (m: Message) => {
    if (!confirm("Delete this message?")) return;
    if (m.attachments?.length) {
      await supabase.storage.from("support-attachments").remove(m.attachments.map(a => a.path));
    }
    const { error } = await supabase.from("support_messages").delete().eq("id", m.id);
    if (error) return toast.error(error.message);
    await logActivity({ action: "delete", entity_type: "support_message", entity_id: m.id });
    toast.success("Deleted");
  };

  const setStatus = async (status: string) => {
    if (!activeId) return;
    const { error } = await supabase.from("support_tickets").update({ status }).eq("id", activeId);
    if (error) return toast.error(error.message);
    await logActivity({ action: `ticket_${status}`, entity_type: "support_ticket", entity_id: activeId });
    toast.success(`Ticket ${status}`);
  };

  const active = tickets.find(t => t.id === activeId);

  return (
    <PageShell title="Customer Support" description={isAdmin ? "Manage HR tickets" : "Chat with admin & raise tickets"}
      actions={!isAdmin ? (
        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogTrigger asChild>
            <Button className="relative overflow-hidden bg-gradient-to-r from-fuchsia-500 via-rose-500 to-amber-500 text-white shadow-[0_10px_40px_-10px_rgba(244,63,94,0.6)] hover:shadow-[0_15px_50px_-10px_rgba(244,63,94,0.8)] transition-all">
              <Plus className="mr-2 h-4 w-4" />New Ticket
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-strong max-w-lg">
            <DialogHeader><DialogTitle>Raise a ticket</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>Subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Category</Label><Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                  <SelectItem value="general">General</SelectItem><SelectItem value="wallet">Wallet</SelectItem><SelectItem value="leads">Leads</SelectItem><SelectItem value="account">Account</SelectItem><SelectItem value="technical">Technical</SelectItem>
                </SelectContent></Select></div>
                <div><Label>Priority</Label><Select value={priority} onValueChange={setPriority}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                  <SelectItem value="low">Low</SelectItem><SelectItem value="normal">Normal</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent></Select></div>
              </div>
              <div><Label>Message</Label><Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} /></div>
            </div>
            <DialogFooter><Button onClick={createTicket} className="bg-gradient-to-r from-fuchsia-500 via-rose-500 to-amber-500 text-white">Submit</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      ) : undefined}
    >
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        {/* Tickets list — premium gradient frame */}
        <div className="relative rounded-2xl p-[1.5px] bg-gradient-to-br from-fuchsia-500/60 via-rose-500/40 to-amber-500/60 shadow-[0_20px_60px_-25px_rgba(244,63,94,0.55)]">
          <div className="absolute -inset-4 -z-10 bg-gradient-to-br from-fuchsia-500/20 via-rose-500/10 to-amber-500/20 blur-2xl opacity-70 pointer-events-none" />
          <div className="glass-strong rounded-[calc(1rem-1px)] p-2 max-h-[70vh] overflow-y-auto">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 mb-2">
              <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-rose-500 shadow-md">
                <Headphones className="h-4 w-4 text-white" />
              </div>
              <div className="text-xs font-semibold tracking-widest uppercase bg-gradient-to-r from-fuchsia-300 via-rose-300 to-amber-300 bg-clip-text text-transparent">
                {isAdmin ? "All Tickets" : "Your Tickets"}
              </div>
            </div>
            {tickets.length === 0 && (
              <div className="p-8 text-center">
                <Sparkles className="mx-auto h-8 w-8 text-fuchsia-400/70 mb-2" />
                <div className="text-sm text-muted-foreground">No tickets yet</div>
              </div>
            )}
            {tickets.map(t => (
              <button key={t.id} onClick={() => setActiveId(t.id)}
                className={cn("relative w-full text-left rounded-xl p-3 mb-1.5 transition-all group",
                  activeId === t.id
                    ? "bg-gradient-to-r from-fuchsia-500/25 via-rose-500/15 to-amber-500/25 border border-fuchsia-400/40 shadow-[0_8px_25px_-10px_rgba(244,63,94,0.5)]"
                    : "hover:bg-white/5 border border-white/5 hover:border-white/15")}>
                {activeId === t.id && (
                  <div className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-gradient-to-b from-fuchsia-400 via-rose-400 to-amber-400" />
                )}
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 font-semibold truncate">{t.subject}</div>
                  <Badge className={cn("shrink-0 border-0",
                    t.status === "open" ? "bg-gradient-to-r from-emerald-500/30 to-green-500/30 text-emerald-200" :
                    t.status === "closed" ? "bg-white/10 text-muted-foreground" :
                    "bg-gradient-to-r from-amber-500/30 to-orange-500/30 text-amber-200")}>{t.status}</Badge>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="truncate">{isAdmin ? (profiles[t.user_id] ?? "HR") : t.category}</span>
                  <span>{new Date(t.last_message_at).toLocaleDateString()}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
        {/* Chat panel — premium gradient frame */}
        <div className="relative rounded-2xl p-[1.5px] bg-gradient-to-br from-amber-500/60 via-rose-500/40 to-fuchsia-500/60 shadow-[0_20px_60px_-25px_rgba(217,70,239,0.5)]">
          <div className="absolute -inset-4 -z-10 bg-gradient-to-br from-amber-500/15 via-rose-500/10 to-fuchsia-500/20 blur-2xl opacity-70 pointer-events-none" />
          <div className="glass-strong rounded-[calc(1rem-1px)] flex flex-col min-h-[60vh]">
          {!active && (
            <div className="grid place-items-center flex-1 text-muted-foreground p-8">
              <div className="relative mb-3">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-fuchsia-500/40 to-amber-500/40 blur-xl" />
                <div className="relative grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-500 shadow-lg">
                  <MessageSquare className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="text-sm">Select a ticket to start chatting</div>
            </div>
          )}
          {active && (
            <>
              <div className="p-4 border-b border-white/10 flex flex-wrap items-center gap-3 bg-gradient-to-r from-fuchsia-500/10 via-rose-500/5 to-amber-500/10 rounded-t-[calc(1rem-1px)]">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-500 shadow-md shrink-0">
                  <MessageSquare className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold truncate bg-gradient-to-r from-fuchsia-200 via-rose-200 to-amber-200 bg-clip-text text-transparent">{active.subject}</div>
                  <div className="text-xs text-muted-foreground capitalize">{active.category} · {active.priority} priority</div>
                </div>
                {isAdmin && active.status !== "closed" && <Button size="sm" variant="outline" onClick={() => setStatus("closed")}><CheckCircle2 className="mr-1 h-4 w-4" />Close</Button>}
                {isAdmin && active.status === "closed" && <Button size="sm" variant="outline" onClick={() => setStatus("open")}><RotateCcw className="mr-1 h-4 w-4" />Reopen</Button>}
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map(m => {
                  const mine = m.sender_id === user?.id;
                  const isEditing = editingId === m.id;
                  const canModify = isAdmin || mine;
                  const images = (m.attachments ?? []).filter(a => a.type.startsWith("image/"));
                  const files = (m.attachments ?? []).filter(a => !a.type.startsWith("image/"));
                  return (
                    <motion.div key={m.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className={cn("group flex", mine ? "justify-end" : "justify-start")}>
                      <div className={cn("relative max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-lg",
                        mine
                          ? "bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-500 text-white shadow-[0_8px_25px_-10px_rgba(244,63,94,0.6)]"
                          : m.sender_role === "admin"
                            ? "bg-gradient-to-br from-fuchsia-500/20 to-rose-500/10 border border-fuchsia-400/30 backdrop-blur"
                            : "bg-white/5 border border-white/10 backdrop-blur")}>
                        {!mine && <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">{m.sender_role}</div>}
                        {isEditing ? (
                          <div className="space-y-2">
                            <Textarea value={editingText} onChange={(e) => setEditingText(e.target.value)} rows={3}
                              className="min-w-[16rem] bg-black/30 text-white placeholder:text-white/60" />
                            <div className="flex gap-1 justify-end">
                              <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setEditingText(""); }} className="h-7 text-xs">Cancel</Button>
                              <Button size="sm" onClick={saveEdit} className="h-7 text-xs bg-white text-primary hover:bg-white/90"><Check className="mr-1 h-3.5 w-3.5" />Save</Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {m.body && <div className="whitespace-pre-wrap">{m.body}</div>}
                            {images.length > 0 && (
                              <div className={cn("mt-2 grid gap-2", images.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
                                {images.map(a => (
                                  <a key={a.path} href={signedUrls[a.path]} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-white/15 bg-black/30">
                                    {signedUrls[a.path]
                                      ? <img src={signedUrls[a.path]} alt={a.name} className="w-full max-h-64 object-cover" loading="lazy" />
                                      : <div className="grid aspect-video place-items-center"><Loader2 className="h-4 w-4 animate-spin" /></div>}
                                  </a>
                                ))}
                              </div>
                            )}
                            {files.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {files.map(a => (
                                  <a key={a.path} href={signedUrls[a.path]} target="_blank" rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-black/30 border border-white/15 px-2 py-1 text-xs hover:bg-black/40">
                                    <FileText className="h-3.5 w-3.5" />
                                    <span className="truncate max-w-[10rem]">{a.name}</span>
                                    <Download className="h-3 w-3 opacity-70" />
                                  </a>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                        <div className="text-[10px] opacity-70 mt-1 flex items-center gap-1">
                          {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          {m.edited_at && <span>· edited</span>}
                        </div>
                        {canModify && !isEditing && (
                          <div className={cn("absolute -top-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity",
                            mine ? "right-2" : "left-2")}>
                            {(mine || isAdmin) && (
                              <button onClick={() => { setEditingId(m.id); setEditingText(m.body); }}
                                className="grid h-7 w-7 place-items-center rounded-full bg-background border border-white/15 shadow hover:bg-white/10">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button onClick={() => deleteMessage(m)}
                              className="grid h-7 w-7 place-items-center rounded-full bg-background border border-white/15 shadow hover:bg-rose-500/20">
                              <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
              {active.status !== "closed" && (
                <div className="p-3 border-t border-white/10 space-y-2 bg-gradient-to-r from-fuchsia-500/5 via-rose-500/5 to-amber-500/5 rounded-b-[calc(1rem-1px)]">
                  {pending.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {pending.map(a => (
                        <div key={a.path} className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-xs">
                          <Paperclip className="h-3.5 w-3.5" />
                          <span className="truncate max-w-[10rem]">{a.name}</span>
                          <button onClick={() => removePending(a)} className="text-muted-foreground hover:text-destructive">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button type="button" size="icon" variant="outline" disabled={uploading}
                      onClick={() => fileRef.current?.click()} className="shrink-0">
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                    </Button>
                    <input ref={fileRef} type="file" multiple hidden
                      accept="image/*,application/pdf,video/*,.doc,.docx,.xls,.xlsx,.txt,.zip"
                      onChange={(e) => uploadFiles(e.target.files)} />
                    <Input value={reply} onChange={(e) => setReply(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                      placeholder="Type a reply or attach files…" className="glass border-fuchsia-400/20 focus-visible:ring-fuchsia-400/40" />
                    <Button onClick={send} disabled={uploading || (!reply.trim() && pending.length === 0)}
                      className="bg-gradient-to-r from-fuchsia-500 via-rose-500 to-amber-500 text-white shadow-[0_8px_25px_-10px_rgba(244,63,94,0.6)] hover:shadow-[0_12px_30px_-10px_rgba(244,63,94,0.8)] transition-all">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}