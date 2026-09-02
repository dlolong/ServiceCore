import "server-only";

import { createClient } from "@/lib/supabase/server";

export type AppointmentPersistenceInput = {
  appointmentId: string | null;
  organizationId: string;
  branchId: string;
  customerId: string;
  serviceIds: string[];
  staffAssignments: Array<{ staffId: string }>;
  resourceAssignments: Array<{ resourceId: string }>;
  scheduledStart: string;
  allowAppointmentConflict?: boolean;
  customerNote: string | null;
  internalNote: string | null;
};

type AppointmentStorageExtension = {
  vehicleId: string | null;
  maintenanceDueId?:string|null;
};

export async function persistAppointment(input: AppointmentPersistenceInput) {
  return persistAppointmentWithExtension(input, { vehicleId: null });
}

/** Storage-only extension used to preserve the existing atomic RPC transaction. */
export async function persistAppointmentWithExtension(input: AppointmentPersistenceInput, extension: AppointmentStorageExtension) {
  const supabase = await createClient();
  const rpcName=extension.maintenanceDueId?"save_maintenance_appointment":"save_appointment_with_assignments";
  const commonPayload={
    p_branch_id: input.branchId,
    p_customer_id: input.customerId,
    p_vehicle_id: extension.vehicleId,
    p_service_ids: input.serviceIds,
    p_staff_membership_ids: input.staffAssignments.map(({ staffId }) => staffId),
    p_resource_ids: input.resourceAssignments.map(({ resourceId }) => resourceId),
    p_starts_at: input.scheduledStart,
    p_customer_note: input.customerNote,
    p_internal_note: input.internalNote,
    p_allow_conflict: input.allowAppointmentConflict ?? false,
  };
  const payload=extension.maintenanceDueId
    ?{...commonPayload,p_maintenance_due_id:extension.maintenanceDueId}
    :{...commonPayload,p_appointment_id:input.appointmentId};
  const { data: appointmentId, error } = await supabase.rpc(rpcName,payload);
  if (error || !appointmentId) {
    const safeMessage = error?.message.includes("unavailable") || error?.message.includes("compatible")
      ? error.message
      : "Unable to save appointment.";
    throw new Error(safeMessage, { cause: error });
  }
  return appointmentId;
}
