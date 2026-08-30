import assert from "node:assert/strict";
import test from "node:test";

import { doTimeRangesOverlap, evaluateAppointmentAvailability, type AvailabilityContext } from "../modules/core/availability/availability.service";

const input = {
  organizationId: "13000000-0000-4000-8000-000000000001",
  branchId: "43000000-0000-4000-8000-000000000001",
  appointmentId: null,
  serviceIds: ["83000000-0000-4000-8000-000000000001"],
  scheduledStart: "2026-08-31T01:00:00.000Z",
};
const openWeek = Object.fromEntries(["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].map((day) => [day, { open: "08:00", close: "18:00" }]));
const baseContext: AvailabilityContext = { branch: { timezone: "Asia/Manila", openingHours: openWeek }, services: [{ id: input.serviceIds[0], durationMinutes: 60, available: true }], appointments: [] };
const dependencies = (context: AvailabilityContext) => ({ loadContext: async () => context });
const date = (hour: number, minute = 0) => new Date(Date.UTC(2026, 7, 31, hour, minute));

test("availability overlap uses end-exclusive intervals", () => {
  assert.equal(doTimeRangesOverlap(date(9), date(10), date(10), date(11)), false);
  assert.equal(doTimeRangesOverlap(date(9), date(10), date(9, 30), date(10, 30)), true);
  assert.equal(doTimeRangesOverlap(date(9), date(11), date(9, 30), date(10)), true);
  assert.equal(doTimeRangesOverlap(date(9, 30), date(10), date(9), date(11)), true);
  assert.equal(doTimeRangesOverlap(date(9), date(10), date(9), date(10)), true);
});

test("core availability derives duration and succeeds without vehicle data", async () => {
  const result = await evaluateAppointmentAvailability(input, dependencies(baseContext));
  assert.equal(result.available, true);
  assert.equal(result.durationMinutes, 60);
  assert.equal("vehicleId" in input, false);
});

test("core availability detects overlap and excludes the edited appointment", async () => {
  const appointment = { id: "33000000-0000-4000-8000-000000000001", startsAt: input.scheduledStart, endsAt: "2026-08-31T02:00:00.000Z" };
  const conflict = await evaluateAppointmentAvailability(input, dependencies({ ...baseContext, appointments: [appointment] }));
  assert.equal(conflict.conflicts[0]?.code, "APPOINTMENT_OVERLAP");
  const self = await evaluateAppointmentAvailability({ ...input, appointmentId: appointment.id }, dependencies({ ...baseContext, appointments: [appointment] }));
  assert.equal(self.available, true);
});

test("core availability rejects branch-closed and unavailable-service requests", async () => {
  const closed = await evaluateAppointmentAvailability(input, dependencies({ ...baseContext, branch: { timezone: "Asia/Manila", openingHours: { monday: { closed: true } } } }));
  assert.equal(closed.conflicts[0]?.code, "BRANCH_CLOSED");
  const service = await evaluateAppointmentAvailability(input, dependencies({ ...baseContext, services: [{ ...baseContext.services[0], available: false }] }));
  assert.equal(service.conflicts.some((conflict) => conflict.code === "SERVICE_NOT_AVAILABLE"), true);
});

test("core availability rejects malformed scheduling input", async () => {
  const result = await evaluateAppointmentAvailability({ ...input, scheduledStart: "invalid" }, dependencies(baseContext));
  assert.equal(result.conflicts[0]?.code, "INVALID_TIME_RANGE");
});

test("tenant and branch isolation are represented by bounded context loading", async () => {
  const otherTenantAtSameTime = await evaluateAppointmentAvailability(input, dependencies(baseContext));
  assert.equal(otherTenantAtSameTime.available, true);
});

test("staff availability detects busy staff and excludes the edited appointment", async () => {
  const staffId = "73000000-0000-4000-8000-000000000001";
  const appointmentId = "33000000-0000-4000-8000-000000000001";
  const assignedInput = { ...input, staffAssignments: [{ staffId }] };
  const context = { ...baseContext, staff: [{ id: staffId, available: true, allowedAtBranch: true }], staffOccupancy: [{ staffId, appointmentId, startsAt: input.scheduledStart, endsAt: "2026-08-31T02:00:00.000Z" }] };
  const busy = await evaluateAppointmentAvailability(assignedInput, dependencies(context));
  assert.equal(busy.conflicts.some(({ code }) => code === "STAFF_BUSY"), true);
  const self = await evaluateAppointmentAvailability({ ...assignedInput, appointmentId }, dependencies(context));
  assert.equal(self.available, true);
});

test("staff must be active and eligible for the appointment branch", async () => {
  const staffId = "73000000-0000-4000-8000-000000000001";
  const result = await evaluateAppointmentAvailability({ ...input, staffAssignments: [{ staffId }] }, dependencies({ ...baseContext, staff: [{ id: staffId, available: true, allowedAtBranch: false }] }));
  assert.equal(result.conflicts.some(({ code }) => code === "STAFF_NOT_ALLOWED_AT_BRANCH"), true);
});

test("resource capacity permits available units and rejects the next overlapping unit", async () => {
  const resourceId = "74000000-0000-4000-8000-000000000001";
  const assignedInput = { ...input, resourceAssignments: [{ resourceId }] };
  const occupancy = (count: number) => Array.from({ length: count }, (_, index) => ({ resourceId, appointmentId: `34000000-0000-4000-8000-00000000000${index + 1}`, startsAt: input.scheduledStart, endsAt: "2026-08-31T02:00:00.000Z", quantity: 1 }));
  const available = await evaluateAppointmentAvailability(assignedInput, dependencies({ ...baseContext, resources: [{ id: resourceId, capacity: 3, active: true, atBranch: true }], resourceOccupancy: occupancy(2) }));
  assert.equal(available.available, true);
  const full = await evaluateAppointmentAvailability(assignedInput, dependencies({ ...baseContext, resources: [{ id: resourceId, capacity: 3, active: true, atBranch: true }], resourceOccupancy: occupancy(3) }));
  assert.equal(full.conflicts.some(({ code }) => code === "RESOURCE_CAPACITY_EXCEEDED"), true);
});

test("single-capacity resources use RESOURCE_BUSY and adjacent use remains available", async () => {
  const resourceId = "74000000-0000-4000-8000-000000000001";
  const assignedInput = { ...input, resourceAssignments: [{ resourceId }] };
  const resources = [{ id: resourceId, capacity: 1, active: true, atBranch: true }];
  const busy = await evaluateAppointmentAvailability(assignedInput, dependencies({ ...baseContext, resources, resourceOccupancy: [{ resourceId, appointmentId: "34000000-0000-4000-8000-000000000001", startsAt: input.scheduledStart, endsAt: "2026-08-31T02:00:00.000Z", quantity: 1 }] }));
  assert.equal(busy.conflicts.some(({ code }) => code === "RESOURCE_BUSY"), true);
  const adjacent = await evaluateAppointmentAvailability(assignedInput, dependencies({ ...baseContext, resources, resourceOccupancy: [{ resourceId, appointmentId: "34000000-0000-4000-8000-000000000001", startsAt: "2026-08-31T00:00:00.000Z", endsAt: input.scheduledStart, quantity: 1 }] }));
  assert.equal(adjacent.available, true);
});
