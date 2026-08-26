import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export const ACTIVE_ORGANIZATION_COOKIE = "karkr-active-organization";

export type OrganizationMembership = {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  organizationPhone: string | null;
  currency: string;
  timezone: string;
  role: "owner" | "manager" | "advisor" | "technician" | "cashier" | "viewer";
  branchName: string;
};

type MembershipRow = {
  organization_id: string;
  role: OrganizationMembership["role"];
  organizations: { name: string; slug: string; phone: string | null; currency: string; timezone: string; branches: Array<{ name: string }> } | null;
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

export async function getDashboardContext() {
  const { supabase, user } = await requireAuthenticatedUser();
  const { data, error } = await supabase
    .from("organization_memberships")
    .select("organization_id, role, organizations!inner(name, slug, phone, currency, timezone, branches(name))")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at");

  if (error) throw new Error("Unable to load organization memberships.", { cause: error });

  const memberships = (data as unknown as MembershipRow[]).flatMap((membership) => {
    if (!membership.organizations) return [];
    return [{
      organizationId: membership.organization_id,
      organizationName: membership.organizations.name,
      organizationSlug: membership.organizations.slug,
      organizationPhone: membership.organizations.phone,
      currency: membership.organizations.currency,
      timezone: membership.organizations.timezone,
      role: membership.role,
      branchName: membership.organizations.branches[0]?.name ?? "No active branch",
    }];
  });

  if (memberships.length === 0) redirect("/onboarding");

  const cookieStore = await cookies();
  const requestedOrganizationId = cookieStore.get(ACTIVE_ORGANIZATION_COOKIE)?.value;
  const activeMembership = memberships.find(({ organizationId }) => organizationId === requestedOrganizationId) ?? memberships[0];

  const { data: profile } = await supabase.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle();

  return {
    user,
    profile: { fullName: profile?.full_name ?? user.user_metadata.full_name ?? user.email ?? "KarKR user", phone: profile?.phone ?? "" },
    memberships,
    activeMembership,
  };
}
