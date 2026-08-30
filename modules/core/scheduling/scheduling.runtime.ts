import "server-only";

import { getDashboardContext } from "@/lib/auth/context";
import { persistAppointment } from "@/lib/supabase/appointment-persistence";
import { createClient } from "@/lib/supabase/server";
import { evaluateAppointmentAvailability } from "@/modules/core/availability/availability.service";
import {
  SchedulingError,
  type SchedulingServiceDependencies,
  type ValidatedSaveAppointmentInput,
} from "@/modules/core/scheduling/scheduling.service";

export const persistCoreAppointment = persistAppointment;

export async function getSchedulingServiceDependencies(): Promise<SchedulingServiceDependencies> {
  return {
    async getActor() {
      const { activeMembership } = await getDashboardContext();
      return {
        organizationId: activeMembership.organizationId,
        role: activeMembership.role,
        branchIds: activeMembership.branches.map(({ id }) => id),
      };
    },
    validateEntities,
    evaluateAvailability: (input) => evaluateAppointmentAvailability(input),
  };
}

async function validateEntities(input: ValidatedSaveAppointmentInput) {
  const supabase = await createClient();
  const [{ data: branch }, { data: customer }] = await Promise.all([
    supabase.from("branches").select("id").eq("id", input.branchId).eq("organization_id", input.organizationId).eq("is_active", true).maybeSingle(),
    supabase.from("customers").select("id").eq("id", input.customerId).eq("organization_id", input.organizationId).eq("is_archived", false).maybeSingle(),
  ]);
  if (!branch) throw new SchedulingError("Branch not available.");
  if (!customer) throw new SchedulingError("Customer not found.");
}
