import { z } from "zod";

export const blockingAppointmentStatuses = ["requested", "confirmed", "checked_in", "queued"] as const;
export type AvailabilityConflictCode = "INVALID_TIME_RANGE" | "BRANCH_CLOSED" | "SERVICE_NOT_AVAILABLE" | "APPOINTMENT_OVERLAP" | "STAFF_NOT_AVAILABLE" | "STAFF_NOT_ALLOWED_AT_BRANCH" | "STAFF_BUSY" | "RESOURCE_NOT_AVAILABLE" | "RESOURCE_NOT_AT_BRANCH" | "RESOURCE_INACTIVE" | "RESOURCE_BUSY" | "RESOURCE_CAPACITY_EXCEEDED";
export type AvailabilityConflict = { type: "invalid_time" | "branch_closed" | "service_unavailable" | "appointment_conflict" | "staff_conflict" | "resource_conflict"; code: AvailabilityConflictCode; message: string; appointmentId?: string; serviceId?: string; staffId?: string; resourceId?: string };
export type AvailabilityResult = { available: boolean; conflicts: AvailabilityConflict[]; scheduledEnd: string | null; durationMinutes: number };

export const evaluateAppointmentAvailabilityInputSchema = z.object({
  organizationId: z.uuid(), branchId: z.uuid(), appointmentId: z.uuid().nullable(),
  serviceIds: z.array(z.uuid()).min(1), scheduledStart: z.iso.datetime({ offset: true }),
  staffAssignments: z.array(z.object({ staffId: z.uuid() })).default([]),
  resourceAssignments: z.array(z.object({ resourceId: z.uuid() })).default([]),
});
export type EvaluateAppointmentAvailabilityInput = z.input<typeof evaluateAppointmentAvailabilityInputSchema>;
type ValidatedInput = z.output<typeof evaluateAppointmentAvailabilityInputSchema>;

export type AvailabilityContext = {
  branch: { timezone: string; openingHours: Record<string, { open?: string; close?: string; closed?: boolean }> } | null;
  services: Array<{ id: string; durationMinutes: number; available: boolean }>;
  appointments: Array<{ id: string; startsAt: string; endsAt: string }>;
  staff?: Array<{ id: string; available: boolean; allowedAtBranch: boolean }>;
  staffOccupancy?: Array<{ staffId: string; appointmentId: string; startsAt: string; endsAt: string }>;
  resources?: Array<{ id: string; capacity: number; active: boolean; atBranch: boolean }>;
  resourceOccupancy?: Array<{ resourceId: string; appointmentId: string; startsAt: string; endsAt: string; quantity: number }>;
};
export type AvailabilityDependencies = { loadContext: (input: ValidatedInput) => Promise<AvailabilityContext> };

export function doTimeRangesOverlap(firstStart: Date, firstEnd: Date, secondStart: Date, secondEnd: Date) {
  return firstStart < secondEnd && firstEnd > secondStart;
}

export function isBlockingAppointmentStatus(status: string) {
  return blockingAppointmentStatuses.includes(status as (typeof blockingAppointmentStatuses)[number]);
}

function branchLocalParts(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? "";
  return { day: part("weekday").toLowerCase(), minutes: Number(part("hour")) * 60 + Number(part("minute")) };
}

function evaluateBranchHours(start: Date, end: Date, context: AvailabilityContext): AvailabilityConflict[] {
  if (!context.branch) return [{ type: "branch_closed", code: "BRANCH_CLOSED", message: "The selected branch is not available." }];
  const startParts = branchLocalParts(start, context.branch.timezone);
  const endParts = branchLocalParts(end, context.branch.timezone);
  const hours = context.branch.openingHours[startParts.day];
  if (!hours || hours.closed || !hours.open || !hours.close || startParts.day !== endParts.day) return [{ type: "branch_closed", code: "BRANCH_CLOSED", message: "The selected time is outside branch operating hours." }];
  const parseMinutes = (value: string) => { const [hour, minute] = value.split(":").map(Number); return hour * 60 + minute; };
  const open = parseMinutes(hours.open), close = parseMinutes(hours.close);
  // The current branch-hours model does not define overnight semantics.
  if (close <= open || startParts.minutes < open || endParts.minutes > close) return [{ type: "branch_closed", code: "BRANCH_CLOSED", message: "The selected time is outside branch operating hours." }];
  return [];
}

export async function evaluateAppointmentAvailability(input: EvaluateAppointmentAvailabilityInput, dependencies?: AvailabilityDependencies): Promise<AvailabilityResult> {
  const parsed = evaluateAppointmentAvailabilityInputSchema.safeParse(input);
  if (!parsed.success) return { available: false, conflicts: [{ type: "invalid_time", code: "INVALID_TIME_RANGE", message: "Appointment time is invalid." }], scheduledEnd: null, durationMinutes: 0 };
  const start = new Date(parsed.data.scheduledStart);
  if (!Number.isFinite(start.valueOf())) return { available: false, conflicts: [{ type: "invalid_time", code: "INVALID_TIME_RANGE", message: "Appointment time is invalid." }], scheduledEnd: null, durationMinutes: 0 };
  let runtimeDependencies = dependencies;
  if (!runtimeDependencies) {
    const runtimeModule = await import("@/modules/core/availability/availability.runtime");
    runtimeDependencies = runtimeModule.availabilityDependencies;
  }
  const context = await runtimeDependencies.loadContext(parsed.data);
  const uniqueServiceIds = [...new Set(parsed.data.serviceIds)];
  const durationMinutes = context.services.filter((service) => uniqueServiceIds.includes(service.id)).reduce((total, service) => total + service.durationMinutes, 0);
  if (durationMinutes <= 0) return { available: false, conflicts: [{ type: "service_unavailable", code: "SERVICE_NOT_AVAILABLE", message: "A selected service is unavailable." }], scheduledEnd: null, durationMinutes: 0 };
  const end = new Date(start.valueOf() + durationMinutes * 60_000);
  const conflicts: AvailabilityConflict[] = [];
  conflicts.push(...evaluateBranchHours(start, end, context));
  for (const serviceId of uniqueServiceIds) if (!context.services.some((service) => service.id === serviceId && service.available)) conflicts.push({ type: "service_unavailable", code: "SERVICE_NOT_AVAILABLE", message: "A selected service is unavailable at this branch.", serviceId });
  for (const appointment of context.appointments) if (appointment.id !== parsed.data.appointmentId && doTimeRangesOverlap(start, end, new Date(appointment.startsAt), new Date(appointment.endsAt))) conflicts.push({ type: "appointment_conflict", code: "APPOINTMENT_OVERLAP", message: "Another appointment overlaps this time.", appointmentId: appointment.id });
  for (const assignment of parsed.data.staffAssignments) {
    const staff = (context.staff ?? []).find(({ id }) => id === assignment.staffId);
    if (!staff?.available) conflicts.push({ type: "staff_conflict", code: "STAFF_NOT_AVAILABLE", message: "A selected staff member is unavailable.", staffId: assignment.staffId });
    else if (!staff.allowedAtBranch) conflicts.push({ type: "staff_conflict", code: "STAFF_NOT_ALLOWED_AT_BRANCH", message: "A selected staff member is not allowed at this branch.", staffId: assignment.staffId });
    else if ((context.staffOccupancy ?? []).some((item) => item.staffId === assignment.staffId && item.appointmentId !== parsed.data.appointmentId && doTimeRangesOverlap(start, end, new Date(item.startsAt), new Date(item.endsAt)))) conflicts.push({ type: "staff_conflict", code: "STAFF_BUSY", message: "A selected staff member is busy.", staffId: assignment.staffId });
  }
  for (const assignment of parsed.data.resourceAssignments) {
    const resource = (context.resources ?? []).find(({ id }) => id === assignment.resourceId);
    if (!resource) conflicts.push({ type: "resource_conflict", code: "RESOURCE_NOT_AVAILABLE", message: "A selected scheduling resource is unavailable.", resourceId: assignment.resourceId });
    else if (!resource.atBranch) conflicts.push({ type: "resource_conflict", code: "RESOURCE_NOT_AT_BRANCH", message: "A selected scheduling resource is not at this branch.", resourceId: assignment.resourceId });
    else if (!resource.active) conflicts.push({ type: "resource_conflict", code: "RESOURCE_INACTIVE", message: "A selected scheduling resource is inactive.", resourceId: assignment.resourceId });
    else {
      const usedCapacity = (context.resourceOccupancy ?? []).filter((item) => item.resourceId === assignment.resourceId && item.appointmentId !== parsed.data.appointmentId && doTimeRangesOverlap(start, end, new Date(item.startsAt), new Date(item.endsAt))).reduce((total, item) => total + item.quantity, 0);
      if (usedCapacity + 1 > resource.capacity) conflicts.push({ type: "resource_conflict", code: resource.capacity === 1 ? "RESOURCE_BUSY" : "RESOURCE_CAPACITY_EXCEEDED", message: resource.capacity === 1 ? "A selected scheduling resource is busy." : "A selected scheduling resource has no remaining capacity.", resourceId: assignment.resourceId });
    }
  }
  return { available: conflicts.length === 0, conflicts, scheduledEnd: end.toISOString(), durationMinutes };
}
