import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { selectOnboardingDestination, type OnboardingDestination } from "@/lib/auth/onboarding-state";

type StateRow = {
  organization_id: string;
  organizations: { branches: Array<{ id: string; is_active: boolean }> } | null;
};

export async function resolveOnboardingDestination(supabase: SupabaseClient, userId: string, preferredOrganizationId?: string | null): Promise<OnboardingDestination> {
  const { data, error } = await supabase
    .from("organization_memberships")
    .select("organization_id, organizations!inner(branches(id, is_active))")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at");

  if (error) throw new Error("Unable to determine account setup status.", { cause: error });

  const memberships = data as unknown as StateRow[];
  return selectOnboardingDestination(memberships.map((membership) => ({
    organizationId: membership.organization_id,
    hasActiveBranch: membership.organizations?.branches.some(({ is_active: isActive }) => isActive) ?? false,
  })), preferredOrganizationId);
}
