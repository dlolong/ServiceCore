import { createClient } from "@supabase/supabase-js";
import { getSupabaseBrowserConfig } from "@/lib/env/client";

/** Anonymous RPC reads must not inherit a visitor's staff session. */
export function createPublicClient() {
  const { url, key } = getSupabaseBrowserConfig();
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
