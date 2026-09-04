import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import defaultLogo from "@/assets/yt-community-logo.asset.json";

let cache: { url: string | null; ts: number } | null = null;
const listeners = new Set<(url: string) => void>();

function bustCache() {
  cache = null;
}

async function fetchLogo(): Promise<string> {
  if (cache && Date.now() - cache.ts < 60_000) return cache.url ?? defaultLogo.url;
  const { data } = await supabase
    .from("brand_settings")
    .select("logo_url")
    .eq("id", 1)
    .maybeSingle();
  const path = data?.logo_url ?? null;
  if (!path) {
    cache = { url: null, ts: Date.now() };
    return defaultLogo.url;
  }
  if (/^https?:\/\//i.test(path)) {
    cache = { url: path, ts: Date.now() };
    return path;
  }
  const { data: signed } = await supabase.storage
    .from("branding")
    .createSignedUrl(path, 60 * 60);
  const url = signed?.signedUrl ?? defaultLogo.url;
  cache = { url, ts: Date.now() };
  return url;
}

export function refreshBrandLogo() {
  bustCache();
  fetchLogo().then((u) => listeners.forEach((l) => l(u)));
}

export function useBrandLogo() {
  const [url, setUrl] = useState<string>(defaultLogo.url);
  useEffect(() => {
    let cancelled = false;
    fetchLogo().then((u) => !cancelled && setUrl(u));
    listeners.add(setUrl);
    const ch = supabase
      .channel(`brand_settings_watch_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "brand_settings" }, () => {
        bustCache();
        fetchLogo().then((u) => !cancelled && setUrl(u));
      })
      .subscribe();
    return () => {
      cancelled = true;
      listeners.delete(setUrl);
      supabase.removeChannel(ch);
    };
  }, []);
  return url;
}