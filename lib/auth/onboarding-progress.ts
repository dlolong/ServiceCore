import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { OrganizationMembership } from "@/lib/auth/context";
import { isMissingSchedulingResources } from "@/lib/auth/database-compatibility";
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

export async function getOnboardingSignals(supabase: SupabaseClient, membership: OrganizationMembership, userId: string): Promise<Record<OnboardingSignalKey, boolean>> {
  const organizationId = membership.organizationId;
  const [branches, services, otherStaff, resources, customers, appointments, vehicles] = await Promise.all([
    readCount(supabase.from("branches").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("is_active", true)),
    readCount(supabase.from("services").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("is_active", true)),
    readCount(supabase.from("organization_memberships").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("is_active", true).neq("user_id", userId)),
    readResourceCount(supabase.from("scheduling_resources").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("is_active", true)),
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
