import { z } from "zod";
import type { AvailabilityResult } from "@/modules/core/availability/availability.service";

const nullableText = (maximumLength: number) => z.string().trim().max(maximumLength).nullable().optional().transform((value) => value || null);

export const saveAppointmentInputSchema = z.object({
  appointmentId: z.uuid().nullable(),
  organizationId: z.uuid(),
  branchId: z.uuid(),
  customerId: z.uuid(),
  serviceIds: z.array(z.uuid()).min(1),
  staffAssignments: z.array(z.object({ staffId: z.uuid() })).default([]),
  resourceAssignments: z.array(z.object({ resourceId: z.uuid() })).default([]),
  scheduledStart: z.iso.datetime({ offset: true }),
  allowAppointmentConflict: z.boolean().optional().default(false),
  customerNote: nullableText(1000),
  internalNote: nullableText(1000),
});

export type SaveAppointmentInput = z.input<typeof saveAppointmentInputSchema>;
export type ValidatedSaveAppointmentInput = z.output<typeof saveAppointmentInputSchema>;
export type AppointmentPersistence = (input: ValidatedSaveAppointmentInput) => Promise<string>;

type SchedulingActor = {
  organizationId: string;
  role: string;
  branchIds: string[];
};

export type SchedulingServiceDependencies = {
  getActor: () => Promise<SchedulingActor>;
  validateEntities: (input: ValidatedSaveAppointmentInput) => Promise<void>;
  evaluateAvailability: (input: ValidatedSaveAppointmentInput) => Promise<AvailabilityResult>;
};

export class SchedulingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchedulingError";
  }
}

const schedulingRoles = new Set(["owner", "manager", "advisor"]);

export async function saveAppointment(input: SaveAppointmentInput) {
  const { getSchedulingServiceDependencies, persistCoreAppointment } = await import("@/modules/core/scheduling/scheduling.runtime");
  return saveAppointmentWithPersistence(input, persistCoreAppointment, await getSchedulingServiceDependencies());
}

/** Adapter seam for verticals that must persist an atomic extension association. */
export async function saveAppointmentWithPersistence(
  input: SaveAppointmentInput,
  persistence: AppointmentPersistence,
  dependencies: SchedulingServiceDependencies,
) {
  const parsed = saveAppointmentInputSchema.safeParse(input);
  if (!parsed.success) throw new SchedulingError(parsed.error.issues[0]?.message ?? "Appointment details are invalid.");

  const actor = await dependencies.getActor();
  if (actor.organizationId !== parsed.data.organizationId || !schedulingRoles.has(actor.role)) {
    throw new SchedulingError("Scheduling access denied.");
  }
  if (!actor.branchIds.includes(parsed.data.branchId)) throw new SchedulingError("Branch not available.");

  await dependencies.validateEntities(parsed.data);
  const availability = await dependencies.evaluateAvailability(parsed.data);
  const overridableCodes = new Set(["APPOINTMENT_OVERLAP", "STAFF_BUSY", "RESOURCE_BUSY", "RESOURCE_CAPACITY_EXCEEDED"]);
  const nonOverridableConflict = availability.conflicts.find((conflict) => !overridableCodes.has(conflict.code));
  if (nonOverridableConflict) throw new SchedulingError(nonOverridableConflict.message);
  if (!availability.available && !parsed.data.allowAppointmentConflict) {
    throw new SchedulingError("The selected appointment, staff, or resource may overlap another booking. Review the schedule and allow an overlapping booking to continue.");
  }
  return persistence(parsed.data);
}
