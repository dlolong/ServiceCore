import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireAutomotiveAppointmentVehicle } from "@/modules/automotive/appointments";
import { saveAppointmentWithPersistence, type SaveAppointmentInput, type SchedulingServiceDependencies } from "@/modules/core/scheduling/scheduling.service";

const automotiveAppointmentSchema = z.object({
  vehicleId: z.uuid({ error: "A vehicle is required for this KarKR booking." }),
  maintenanceDueId: z.uuid().nullable().optional(),
});

export type SaveAutomotiveAppointmentInput = SaveAppointmentInput & {
  vehicleId: string | null | undefined;
  maintenanceDueId?:string|null;
};

export type AutomotiveSchedulingDependencies = {
  validateVehicle: (organizationId: string, customerId: string, vehicleId: string) => Promise<void>;
  getActiveMaintenanceAppointment?: (input:{maintenanceDueId:string;branchId:string;customerId:string;vehicleId:string;serviceIds:string[]}) => Promise<string|null>;
  coreDependencies?: SchedulingServiceDependencies;
  persist?: (input: SaveAppointmentInput, vehicleId: string, maintenanceDueId:string|null) => Promise<string>;
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
  async getActiveMaintenanceAppointment(input){
    const supabase=await createClient();
    const{data,error}=await supabase.rpc("get_active_maintenance_appointment",{
      p_due_id:input.maintenanceDueId,p_branch_id:input.branchId,p_customer_id:input.customerId,
      p_vehicle_id:input.vehicleId,p_service_ids:input.serviceIds,
    });
    if(error)throw new AutomotiveSchedulingError(error.message);
    return data??null;
  },
};

export async function saveAutomotiveAppointment(
  input: SaveAutomotiveAppointmentInput,
  dependencies: AutomotiveSchedulingDependencies = productionDependencies,
) {
  const vehicleId = requireAutomotiveAppointmentVehicle(input.vehicleId);
  const vehicleResult = automotiveAppointmentSchema.safeParse({ vehicleId,maintenanceDueId:input.maintenanceDueId??null });
  if (!vehicleResult.success) throw new AutomotiveSchedulingError(vehicleResult.error.issues[0]?.message ?? "A vehicle is required for this KarKR booking.");

  await dependencies.validateVehicle(input.organizationId, input.customerId, vehicleResult.data.vehicleId);
  const maintenanceDueId=vehicleResult.data.maintenanceDueId??null;
  if(maintenanceDueId&&input.appointmentId)throw new AutomotiveSchedulingError("Maintenance linkage is only available when creating an appointment.");
  if(maintenanceDueId&&dependencies.getActiveMaintenanceAppointment){
    const existingAppointmentId=await dependencies.getActiveMaintenanceAppointment({
      maintenanceDueId,branchId:input.branchId,customerId:input.customerId,
      vehicleId:vehicleResult.data.vehicleId,serviceIds:input.serviceIds,
    });
    if(existingAppointmentId)return existingAppointmentId;
  }
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
      ? dependencies.persist(validatedInput, vehicleResult.data.vehicleId,maintenanceDueId)
      : import("@/lib/supabase/appointment-persistence").then(({ persistAppointmentWithExtension }) =>
        persistAppointmentWithExtension(validatedInput, { vehicleId: vehicleResult.data.vehicleId,maintenanceDueId })),
    coreDependencies,
  );
}
