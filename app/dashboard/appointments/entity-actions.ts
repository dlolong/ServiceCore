"use server";

import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { createVisitCustomer, createVisitVehicle } from "@/lib/visit-entities";

export async function createAppointmentCustomer(input: unknown) {
  const { activeMembership } = await getDashboardContext();
  return createVisitCustomer(input, activeMembership, await createClient());
}

export async function createAppointmentVehicle(input: unknown) {
  const { activeMembership } = await getDashboardContext();
  return createVisitVehicle(input, activeMembership, await createClient());
}
