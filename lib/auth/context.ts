import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { resolveOnboardingDestination } from "@/lib/auth/onboarding";

export const ACTIVE_ORGANIZATION_COOKIE = "karkr-active-organization";
export const ACTIVE_BRANCH_COOKIE = "karkr-active-branch";

export type BranchSummary = { id: string; name: string; isPrimary: boolean };

export type OrganizationMembership = {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  organizationPhone: string | null;
  currency: string;
  timezone: string;
  role: "owner" | "manager" | "advisor" | "technician" | "cashier" | "viewer";
  branchId: string;
  branchName: string;
  branches: BranchSummary[];
};

type MembershipRow = {
  organization_id: string;
  role: OrganizationMembership["role"];
  organizations: { name: string; slug: string; phone: string | null; currency: string; timezone: string; branches: Array<{ id: string; name: string; is_primary: boolean; is_active: boolean }> } | null;
};

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
  const { data, error } = await supabase
    .from("organization_memberships")
    .select("organization_id, role, organizations!inner(name, slug, phone, currency, timezone, branches(id, name, is_primary, is_active))")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at");

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
      organizationId: membership.organization_id,
      organizationName: membership.organizations.name,
      organizationSlug: membership.organizations.slug,
      organizationPhone: membership.organizations.phone,
      currency: membership.organizations.currency,
      timezone: membership.organizations.timezone,
      role: membership.role,
      branchId: branch?.id ?? "",
      branchName: branch?.name ?? "No active branch",
      branches: branches.map(({ id, name, is_primary }) => ({ id, name, isPrimary: is_primary })),
    }];
  });

  if (memberships.length === 0) redirect("/onboarding/business");

  const requestedOrganizationId = cookieStore.get(ACTIVE_ORGANIZATION_COOKIE)?.value;
  const activeMembership = memberships.find(({ organizationId }) => organizationId === requestedOrganizationId) ?? memberships[0];
  if (!activeMembership.branchId) {
    const destination = await resolveOnboardingDestination(supabase, user.id, activeMembership.organizationId);
    redirect(destination.path);
  }

  const { data: profile } = await supabase.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle();

  return {
    user,
    profile: { fullName: profile?.full_name ?? user.user_metadata.full_name ?? user.email ?? "KarKR user", phone: profile?.phone ?? "" },
    memberships,
    activeMembership,
  };
});
