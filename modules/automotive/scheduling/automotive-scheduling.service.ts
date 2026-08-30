import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireAutomotiveAppointmentVehicle } from "@/modules/automotive/appointments";
import { saveAppointmentWithPersistence, type SaveAppointmentInput, type SchedulingServiceDependencies } from "@/modules/core/scheduling/scheduling.service";

const automotiveAppointmentSchema = z.object({
  vehicleId: z.uuid({ error: "A vehicle is required for this KarKR booking." }),
});

export type SaveAutomotiveAppointmentInput = SaveAppointmentInput & {
  vehicleId: string | null | undefined;
};

export type AutomotiveSchedulingDependencies = {
  validateVehicle: (organizationId: string, customerId: string, vehicleId: string) => Promise<void>;
  coreDependencies?: SchedulingServiceDependencies;
  persist?: (input: SaveAppointmentInput, vehicleId: string) => Promise<string>;
};

export class AutomotiveSchedulingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AutomotiveSchedulingError";
  }
}

const productionDependencies: AutomotiveSchedulingDependencies = {
  async validateVehicle(organizationId, customerId, vehicleId) {
    const supabase = await createClient();
    const { data: vehicle } = await supabase.from("vehicles").select("id,customer_id").eq("id", vehicleId).eq("organization_id", organizationId).eq("is_archived", false).maybeSingle();
    if (!vehicle) throw new AutomotiveSchedulingError("Vehicle not found.");
    if (vehicle.customer_id !== customerId) throw new AutomotiveSchedulingError("Vehicle does not belong to this customer.");
  },
};

export async function saveAutomotiveAppointment(
  input: SaveAutomotiveAppointmentInput,
  dependencies: AutomotiveSchedulingDependencies = productionDependencies,
) {
  const vehicleId = requireAutomotiveAppointmentVehicle(input.vehicleId);
  const vehicleResult = automotiveAppointmentSchema.safeParse({ vehicleId });
  if (!vehicleResult.success) throw new AutomotiveSchedulingError(vehicleResult.error.issues[0]?.message ?? "A vehicle is required for this KarKR booking.");

  await dependencies.validateVehicle(input.organizationId, input.customerId, vehicleResult.data.vehicleId);
  const coreInput: SaveAppointmentInput = {
    appointmentId: input.appointmentId,
    organizationId: input.organizationId,
    branchId: input.branchId,
    customerId: input.customerId,
    serviceIds: input.serviceIds,
    staffAssignments: input.staffAssignments,
    resourceAssignments: input.resourceAssignments,
    scheduledStart: input.scheduledStart,
    allowAppointmentConflict: input.allowAppointmentConflict,
    customerNote: input.customerNote,
    internalNote: input.internalNote,
  };
  let coreDependencies = dependencies.coreDependencies;
  if (!coreDependencies) {
    const runtime = await import("@/modules/core/scheduling/scheduling.runtime");
    coreDependencies = await runtime.getSchedulingServiceDependencies();
  }
  return saveAppointmentWithPersistence(
    coreInput,
    (validatedInput) => dependencies.persist
      ? dependencies.persist(validatedInput, vehicleResult.data.vehicleId)
      : import("@/lib/supabase/appointment-persistence").then(({ persistAppointmentWithExtension }) =>
        persistAppointmentWithExtension(validatedInput, { vehicleId: vehicleResult.data.vehicleId })),
    coreDependencies,
  );
}
