import { SchedulingError } from "@/modules/core/scheduling/scheduling.service";
import type { DatabaseError } from "@/lib/supabase/schema-compatibility";

// Only known database business-rule messages may reach the appointment form.
const appointmentMessages = new Map([
  ["Appointment time is invalid", "Choose an appointment time within the last 24 hours or in the future."],
  ["Appointment time is too far in the past", "Choose an appointment time within the last 24 hours or in the future."],
  ["Select at least one service", "Select at least one service."],
  ["Selected service is unavailable", "A selected service is no longer available. Refresh and select an active service."],
  ["Appointment service is unavailable", "A selected service is no longer available. Refresh and select an active service."],
  ["Service is unavailable at this branch", "A selected service is unavailable at this branch. Choose another service or branch."],
  ["This add-on requires its compatible parent service", "Select the parent service required by the selected add-on, or remove the add-on."],
  ["Another appointment overlaps this time", "Another appointment overlaps this time. Choose another time or review the overlap option."],
  ["A selected staff member is busy", "The selected staff member is already booked at this time."],
  ["Staff member is not allowed at this branch", "The selected staff member is unavailable at this branch. Choose another staff member or leave staff unassigned."],
  ["Scheduling resource is not available at this branch", "The selected resource is unavailable at this branch. Choose another resource or leave it unassigned."],
  ["Scheduling resource capacity exceeded", "The selected resource is fully booked at this time. Choose another resource or time."],
  ["Duplicate staff assignment", "Select each staff member only once."],
  ["Duplicate resource assignment", "Select each resource only once."],
  ["This appointment can no longer be edited", "This appointment can no longer be edited because its status has changed. Refresh the appointment."],
  ["Appointment vehicle/customer mismatch", "Select a vehicle that belongs to the selected customer."],
  ["Appointment does not match this maintenance item", "The customer, vehicle, branch, or service does not match the selected maintenance item."],
]);

export function appointmentPersistenceError(error: DatabaseError): Error {
  if (error?.code === "23502" && error.message === 'null value in column "vehicle_id" of relation "appointments" violates not-null constraint') {
    return new SchedulingError("Appointments without a vehicle are currently unavailable. Ask an administrator to complete appointment setup.");
  }
  if (error?.code === "P0001" || error?.code === "42501") {
    const message = appointmentMessages.get(error.message ?? "");
    if (message) return new SchedulingError(message);
    if (error.code === "42501") return new SchedulingError("You no longer have access to save this appointment. Refresh and check your organization and branch.");
  }
  return new Error("Unable to save appointment.", { cause: error });
}
