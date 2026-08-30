import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseBrowserConfig } from "@/lib/env/client";import{serverEnv}from"@/lib/env/server";
export function createAdminClient(){if(!serverEnv.SUPABASE_SERVICE_ROLE_KEY)throw new Error("Supabase service role is not configured.");const{url}=getSupabaseBrowserConfig();return createClient(url,serverEnv.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})}
