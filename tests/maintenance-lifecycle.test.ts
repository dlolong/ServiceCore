import assert from "node:assert/strict";
import test from "node:test";

import {
  assertMaintenanceBackfillApplySafety,
  runMaintenanceBackfill,
  type MaintenanceBackfillRepository,
} from "../modules/automotive/maintenance/backfill";
import {
  evaluateMaintenanceReminderEligibility,
  isMaintenanceAppointmentActive,
} from "../modules/automotive/maintenance/reminder-eligibility";

const organizationId = "13000000-0000-4000-8000-000000000001";
const reportId = "73000000-0000-4000-8000-000000000001";
const now = new Date("2026-09-01T00:00:00.000Z");
const eligibleInput = {
  lifecycleStatus: "active",
  vehicleArchived: false,
  appointmentStatus: null,
  snoozedUntil: null,
  notificationsEnabled: true,
  now,
} as const;

test("maintenance appointment policy uses only established active scheduling statuses", () => {
  for (const status of ["requested", "confirmed", "checked_in", "queued"] as const) {
    assert.equal(isMaintenanceAppointmentActive(status), true);
  }
  for (const status of ["completed", "cancelled", "no_show", null] as const) {
    assert.equal(isMaintenanceAppointmentActive(status), false);
  }
});

test("maintenance reminder eligibility has deterministic suppression precedence", () => {
  assert.equal(evaluateMaintenanceReminderEligibility({ ...eligibleInput, lifecycleStatus: "satisfied", vehicleArchived: true, appointmentStatus: "confirmed", snoozedUntil: "2026-09-20T00:00:00.000Z" }), "MAINTENANCE_COMPLETED");
  assert.equal(evaluateMaintenanceReminderEligibility({ ...eligibleInput, vehicleArchived: true, appointmentStatus: "confirmed", snoozedUntil: "2026-09-20T00:00:00.000Z" }), "VEHICLE_INACTIVE");
  assert.equal(evaluateMaintenanceReminderEligibility({ ...eligibleInput, appointmentStatus: "confirmed", snoozedUntil: "2026-09-20T00:00:00.000Z" }), "ACTIVE_RELATED_APPOINTMENT");
  assert.equal(evaluateMaintenanceReminderEligibility({ ...eligibleInput, appointmentStatus: "cancelled", snoozedUntil: "2026-09-20T00:00:00.000Z" }), "SNOOZED");
});

test("expired snooze resumes eligibility without resetting sent-stage deduplication", () => {
  assert.equal(evaluateMaintenanceReminderEligibility({ ...eligibleInput, snoozedUntil: "2026-08-31T00:00:00.000Z" }), "ELIGIBLE");
  assert.equal(evaluateMaintenanceReminderEligibility({ ...eligibleInput, snoozedUntil: "2026-08-31T00:00:00.000Z", stageAlreadySent: true }), "ALREADY_REMINDER_STAGE_SENT");
  assert.equal(evaluateMaintenanceReminderEligibility({ ...eligibleInput, notificationsEnabled: false }), "LEGACY_BACKFILL_NOT_ACTIVATED");
});

test("maintenance backfill defaults can execute a dry plan with zero apply calls", async () => {
  let planCalls = 0;
  let applyCalls = 0;
  const repository: MaintenanceBackfillRepository = {
    plan: async () => { planCalls += 1; return { summary: { scanned: 2 } }; },
    apply: async () => { applyCalls += 1; return {}; },
  };
  const report = await runMaintenanceBackfill({ organizationId, limit: 25, mode: "dry-run", reportId }, repository);
  assert.equal(planCalls, 1);
  assert.equal(applyCalls, 0);
  assert.equal(report.mode, "dry-run");
  assert.deepEqual(report.scope, { organizationId, limit: 25 });
});

test("production maintenance backfill apply requires both explicit guards", () => {
  assert.throws(() => assertMaintenanceBackfillApplySafety({ mode: "apply", organizationId, nodeEnvironment: "production", productionConfirmation: organizationId, confirmProduction: false }), /requires --confirm-production/);
  assert.throws(() => assertMaintenanceBackfillApplySafety({ mode: "apply", organizationId, nodeEnvironment: "production", productionConfirmation: "wrong", confirmProduction: true }), /requires --confirm-production/);
  assert.doesNotThrow(() => assertMaintenanceBackfillApplySafety({ mode: "apply", organizationId, nodeEnvironment: "production", productionConfirmation: organizationId, confirmProduction: true }));
});
