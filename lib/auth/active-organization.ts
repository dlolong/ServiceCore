import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { ACTIVE_BRANCH_COOKIE, ACTIVE_ORGANIZATION_COOKIE } from "@/lib/auth/context";
import { resolveOnboardingDestination } from "@/lib/auth/onboarding";

const organizationCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};

export async function activateOrganizationForUser(supabase: SupabaseClient, userId: string, organizationId: string) {
  const { data, error } = await supabase
    .from("organization_memberships")
    .select("organization_id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) return null;

  const destination = await resolveOnboardingDestination(supabase, userId, data.organization_id);
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORGANIZATION_COOKIE, data.organization_id, organizationCookieOptions);
  cookieStore.delete(ACTIVE_BRANCH_COOKIE);
  return destination;
}
