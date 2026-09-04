import { useRef, useState } from "react";
import { Loader2, Upload, RotateCcw, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useBrandLogo, refreshBrandLogo } from "@/hooks/use-brand-logo";
import { Button } from "@/components/ui/button";
import { logActivity } from "@/lib/activity-log";

export function BrandLogoEditor() {
  const { role, user } = useAuth();
  const isAdmin = role === "admin";
  const logo = useBrandLogo();
  const [uploading, setUploading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!isAdmin) return null;

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Please upload an image");
    if (file.size > 4 * 1024 * 1024) return toast.error("Logo must be under 4 MB");
    setUploading(true);
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `logo-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("branding")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) {
      setUploading(false);
      return toast.error(upErr.message);
    }
    const { error: dbErr } = await supabase
      .from("brand_settings")
      .upsert({ id: 1, logo_url: path, updated_by: user?.id ?? null, updated_at: new Date().toISOString() });
    setUploading(false);
    if (dbErr) return toast.error(dbErr.message);
    await logActivity({ action: "update", entity_type: "brand_settings", entity_id: "1" });
    refreshBrandLogo();
    toast.success("Logo updated");
  };

  const resetToDefault = async () => {
    setResetting(true);
    const { error } = await supabase
      .from("brand_settings")
      .upsert({ id: 1, logo_url: null, updated_by: user?.id ?? null, updated_at: new Date().toISOString() });
    setResetting(false);
    if (error) return toast.error(error.message);
    await logActivity({ action: "reset", entity_type: "brand_settings", entity_id: "1" });
    refreshBrandLogo();
    toast.success("Reverted to default logo");
  };

  return (
    <div className="glass rounded-2xl p-6">
      <div className="mb-4 flex items-center gap-2">
        <ImageIcon className="h-4 w-4 text-primary" />
        <h3 className="text-base font-bold">App Logo</h3>
        <span className="ml-auto rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary">Admin only</span>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        This logo shows in the sidebar for every user. Recommended: square PNG, transparent background, at least 512×512.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-fuchsia-500/20 via-violet-500/20 to-indigo-600/20 ring-1 ring-white/20">
          <img src={logo} alt="Current logo" className="h-full w-full object-contain" />
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
          <Button
            onClick={() => fileRef.current?.click()}
            disabled={uploading || resetting}
            className="gradient-primary text-white border-0"
          >
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Upload new logo
          </Button>
          <Button
            variant="outline"
            onClick={resetToDefault}
            disabled={uploading || resetting}
          >
            {resetting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
            Reset to default
          </Button>
        </div>
      </div>
    </div>
  );
}