import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { OrganizationMembership } from "@/lib/auth/context";
import { isMissingSchedulingResources } from "@/lib/auth/database-compatibility";
import {
  isMissingCanonicalStaffProfileId,
  isMissingOrganizationStaffProfilesRelation,
} from "@/lib/supabase/schema-compatibility";
import type { OnboardingSignalKey } from "@/modules/platform/onboarding";

type CountResult = { count: number | null; error: { code?: string; message: string } | null };

async function readCount(query: PromiseLike<CountResult>) {
  const { count, error } = await query;
  if (error) throw new Error("Unable to determine setup progress.", { cause: error });
  return count ?? 0;
}

async function readResourceCount(query: PromiseLike<CountResult>) {
  const { count, error } = await query;
  if (isMissingSchedulingResources(error)) return 0;
  if (error) throw new Error("Unable to determine setup progress.", { cause: error });
  return count ?? 0;
}

async function readStaffCount(
  supabase: SupabaseClient,
  membership: OrganizationMembership,
  userId: string,
) {
  // Canonical Staff profiles are operational identities and do not require a
  // login membership. Exclude the owner's own auto-created linked profile.
  const canonical = await supabase
    .from("organization_staff_profiles")
    // Keep this as a bounded GET rather than HEAD. PostgREST omits an error
    // body for failed HEAD requests, which hides the missing-column code that
    // the rolling-schema fallback below needs on pre-0055 databases.
    .select("id", { count: "exact" })
    .eq("organization_id", membership.organizationId)
    .eq("is_active", true)
    .or(`membership_id.is.null,membership_id.neq.${membership.membershipId}`)
    .limit(1);

  if (!canonical.error) return canonical.count ?? 0;
  const missingCanonicalStaffProfiles = isMissingCanonicalStaffProfileId(canonical.error)
    || isMissingOrganizationStaffProfilesRelation(canonical.error);
  if (!missingCanonicalStaffProfiles) {
    throw new Error("Unable to determine setup progress.", { cause: canonical.error });
  }

  // Before migration 0055, Staff and login membership were the same identity.
  // Keep this exact schema fallback only for rolling development deployments.
  return readCount(supabase
    .from("organization_memberships")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", membership.organizationId)
    .eq("is_active", true)
    .neq("user_id", userId));
}

export async function getOnboardingSignals(supabase: SupabaseClient, membership: OrganizationMembership, userId: string): Promise<Record<OnboardingSignalKey, boolean>> {
  const organizationId = membership.organizationId;
  const [branches, services, otherStaff, resources, customers, appointments, vehicles] = await Promise.all([
    readCount(supabase.from("branches").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("is_active", true)),
    readCount(supabase.from("services").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("is_active", true)),
    readStaffCount(supabase, membership, userId),
    // This compatibility-aware read must also retain the PostgREST error body.
    readResourceCount(supabase.from("scheduling_resources").select("id", { count: "exact" }).eq("organization_id", organizationId).eq("is_active", true).limit(1)),
    readCount(supabase.from("customers").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("is_archived", false)),
    readCount(supabase.from("appointments").select("id", { count: "exact", head: true }).eq("organization_id", organizationId)),
    membership.industry === "automotive"
      ? readCount(supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("is_archived", false))
      : Promise.resolve(0),
  ]);

  return {
    branch: branches > 0,
    services: services > 0,
    staff: otherStaff > 0,
    resources: resources > 0,
    customers: customers > 0,
    vehicles: vehicles > 0,
    appointments: appointments > 0,
  };
}
