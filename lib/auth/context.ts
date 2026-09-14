import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { isMissingOrganizationIndustry } from "@/lib/auth/database-compatibility";
import { resolveOnboardingDestination } from "@/lib/auth/onboarding";
import { selectActiveMembership } from "@/lib/auth/onboarding-state";
import { resolveIndustryConfig, type IndustryKey } from "@/modules/platform/industry";
import { resolveDashboardTheme } from "@/modules/platform/dashboard-theme";

export const ACTIVE_ORGANIZATION_COOKIE = "servicecore-active-organization";
export const ACTIVE_BRANCH_COOKIE = "servicecore-active-branch";

export type BranchSummary = { id: string; name: string; isPrimary: boolean };

export type OrganizationMembership = {
  membershipId: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  organizationPhone: string | null;
  currency: string;
  timezone: string;
  industry: IndustryKey;
  role: "owner" | "manager" | "advisor" | "technician" | "cashier" | "viewer";
  branchId: string;
  branchName: string;
  branches: BranchSummary[];
};

type MembershipRow = {
  id: string;
  organization_id: string;
  role: OrganizationMembership["role"];
  organizations: { name: string; slug: string; phone: string | null; currency: string; timezone: string; industry?: string; branches: Array<{ id: string; name: string; is_primary: boolean; is_active: boolean }> } | null;
};

export async function loadActiveOrganizationMembershipRows(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const currentResult = await supabase
    .from("organization_memberships")
    .select("id, organization_id, role, organizations!inner(name, slug, phone, currency, timezone, industry, branches(id, name, is_primary, is_active))")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at");

  if (!isMissingOrganizationIndustry(currentResult.error)) return currentResult;

  // Before the vertical migration every organization was a KarKR tenant.
  return supabase
    .from("organization_memberships")
    .select("id, organization_id, role, organizations!inner(name, slug, phone, currency, timezone, branches(id, name, is_primary, is_active))")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at");
}

export async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return { supabase, user };
}

export async function requireAuthenticatedUser(next = "/dashboard") {
  const auth = await getAuthenticatedUser();
  if (!auth) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  return auth;
}

export const getDashboardContext = cache(async function getDashboardContext() {
  const { supabase, user } = await requireAuthenticatedUser();
  const { data, error } = await loadActiveOrganizationMembershipRows(supabase, user.id);

  if (error) throw new Error("Unable to load organization memberships.", { cause: error });

  const cookieStore = await cookies();
  const requestedBranchId = cookieStore.get(ACTIVE_BRANCH_COOKIE)?.value;
  const memberships = (data as unknown as MembershipRow[]).flatMap((membership) => {
    if (!membership.organizations) return [];
    const branches = membership.organizations.branches
      .filter(({ is_active: isActive }) => isActive)
      .sort((left, right) => Number(right.is_primary) - Number(left.is_primary));
    const branch = branches.find(({ id }) => id === requestedBranchId) ?? branches[0];
    return [{
      membershipId: membership.id,
      organizationId: membership.organization_id,
      organizationName: membership.organizations.name,
      organizationSlug: membership.organizations.slug,
      organizationPhone: membership.organizations.phone,
      currency: membership.organizations.currency,
      timezone: membership.organizations.timezone,
      industry: resolveIndustryConfig(membership.organizations.industry ?? "automotive").key,
      role: membership.role,
      branchId: branch?.id ?? "",
      branchName: branch?.name ?? "No active branch",
      branches: branches.map(({ id, name, is_primary }) => ({ id, name, isPrimary: is_primary })),
    }];
  });

  if (memberships.length === 0) redirect("/onboarding/business");

  const requestedOrganizationId = cookieStore.get(ACTIVE_ORGANIZATION_COOKIE)?.value;
  const activeMembership = selectActiveMembership(memberships, requestedOrganizationId);
  if (!activeMembership) redirect("/organizations");
  if (!activeMembership.branchId) {
    const destination = await resolveOnboardingDestination(supabase, user.id, activeMembership.organizationId);
    redirect(destination.path);
  }

  const { data: profile } = await supabase.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle();

  return {
    user,
    profile: {
      fullName: profile?.full_name ?? user.user_metadata.full_name ?? user.email ?? "NegOSu user",
      phone: profile?.phone ?? "",
      dashboardTheme: resolveDashboardTheme(user.user_metadata.dashboard_theme),
    },
    memberships,
    activeMembership,
  };
});
