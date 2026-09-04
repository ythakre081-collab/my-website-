import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Upload, ClipboardPaste, Users, Loader2, CheckCircle2, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { parseFile, parsePastedText, type ParsedLead } from "@/lib/lead-parse";
import type { HrProfile } from "@/hooks/use-auth";

export const Route = createFileRoute("/_app/upload-leads")({
  component: UploadLeadsPage,
});

function UploadLeadsPage() {
  const [hrs, setHrs] = useState<HrProfile[]>([]);
  const [assignTo, setAssignTo] = useState<string>("");
  const [bucket, setBucket] = useState<"today" | "tomorrow">("today");
  const [pasted, setPasted] = useState("");
  const [preview, setPreview] = useState<ParsedLead[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase
      .from("hr_profiles")
      .select("*")
      .eq("status", "approved")
      .order("full_name")
      .then(({ data }) => setHrs((data ?? []) as HrProfile[]));
  }, []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await parseFile(file);
      setPreview(rows);
      toast.success(`Detected ${rows.length} unique leads`);
    } catch (err) {
      toast.error("Failed to parse file");
      console.error(err);
    } finally {
      e.target.value = "";
    }
  }

  function onPasteParse() {
    const rows = parsePastedText(pasted);
    setPreview(rows);
    toast.success(`Detected ${rows.length} unique leads`);
  }

  async function upload() {
    if (!preview.length) return toast.error("No leads to upload");
    if (!assignTo) return toast.error("Select an HR to assign");
    setBusy(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const rows = preview.map((l) => ({
      name: l.name,
      mobile: l.mobile,
      bucket,
      status: "assigned" as const,
      assigned_to: assignTo,
      assigned_at: new Date().toISOString(),
      created_by: user?.id ?? null,
    }));

    // Insert in chunks; ignore duplicates via mobile unique constraint
    let inserted = 0;
    let dupes = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { data, error } = await supabase
        .from("leads")
        .upsert(chunk, { onConflict: "mobile", ignoreDuplicates: true })
        .select("id");
      if (error) {
        toast.error(error.message);
        setBusy(false);
        return;
      }
      inserted += data?.length ?? 0;
      dupes += chunk.length - (data?.length ?? 0);
    }

    setBusy(false);
    setPreview([]);
    setPasted("");
    toast.success(`Uploaded ${inserted} leads · Skipped ${dupes} duplicates`);
  }

  return (
    <PageShell title="Upload Leads" description="Paste or upload leads; auto-detect columns and remove duplicates">
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-6 space-y-4"
        >
          <Tabs defaultValue="paste">
            <TabsList className="glass border border-border">
              <TabsTrigger value="paste"><ClipboardPaste className="mr-1 h-3.5 w-3.5" />Bulk Paste</TabsTrigger>
              <TabsTrigger value="file"><FileSpreadsheet className="mr-1 h-3.5 w-3.5" />Excel / CSV</TabsTrigger>
            </TabsList>
            <TabsContent value="paste" className="mt-4 space-y-3">
              <Textarea
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                rows={10}
                placeholder={`Paste rows. Any of:\nName, Mobile\nJohn, 9876543210\n\nor CSV with headers like Candidate Name, Phone Number`}
                className="glass border-border font-mono text-xs"
              />
              <Button onClick={onPasteParse} variant="outline" className="glass border-border">
                Parse pasted data
              </Button>
            </TabsContent>
            <TabsContent value="file" className="mt-4">
              <label className="glass-strong flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 p-10 text-center hover:border-primary/50">
                <Upload className="h-8 w-8 text-primary" />
                <div className="font-semibold">Drop XLSX / CSV or click to browse</div>
                <div className="text-xs text-muted-foreground">
                  Auto-detects columns like Name / Candidate / Phone / Mobile — up to 5,000+ rows
                </div>
                <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onFile} />
              </label>
            </TabsContent>
          </Tabs>

          {preview.length > 0 && (
            <div className="glass rounded-2xl p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold">Preview · {preview.length} unique leads</div>
                <Button size="sm" variant="ghost" onClick={() => setPreview([])}>Clear</Button>
              </div>
              <div className="max-h-72 overflow-y-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-white/5 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-left">Mobile</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 200).map((l) => (
                      <tr key={l.mobile} className="border-t border-border">
                        <td className="px-3 py-1.5">{l.name}</td>
                        <td className="px-3 py-1.5 font-mono text-xs">{l.mobile}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.length > 200 && (
                  <div className="p-2 text-center text-xs text-muted-foreground">
                    …and {preview.length - 200} more
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass rounded-2xl p-6 h-fit space-y-4"
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4" /> Assignment
          </div>

          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Bucket</Label>
            <Select value={bucket} onValueChange={(v) => setBucket(v as "today" | "tomorrow")}>
              <SelectTrigger className="mt-1 glass border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today's Leads</SelectItem>
                <SelectItem value="tomorrow">Tomorrow's Leads</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Assign to HR</Label>
            <Select value={assignTo} onValueChange={setAssignTo}>
              <SelectTrigger className="mt-1 glass border-border">
                <SelectValue placeholder="Select approved HR" />
              </SelectTrigger>
              <SelectContent>
                {hrs.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.full_name} · {h.hr_code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={upload}
            disabled={busy || !preview.length}
            className="w-full gradient-primary text-white border-0"
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Upload {preview.length || ""} lead{preview.length === 1 ? "" : "s"}
          </Button>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Duplicate mobile numbers are removed automatically. Already-assigned leads are never reassigned.
          </p>
        </motion.div>
      </div>
    </PageShell>
  );
}