import assert from "node:assert/strict";
import test from "node:test";

import { normalizeActionError } from "../lib/errors/action-error";
import { appointmentPersistenceError } from "../lib/supabase/appointment-persistence-errors";

test("appointment database validation survives the action's error boundary", () => {
  for (const [message, expected] of [
    ["Appointment time is invalid", "Choose an appointment time within the last 24 hours or in the future."],
    ["This add-on requires its compatible parent service", "Select the parent service required by the selected add-on, or remove the add-on."],
    ["Appointment vehicle/customer mismatch", "Select a vehicle that belongs to the selected customer."],
    ["A selected staff member is busy", "The selected staff member is already booked at this time."],
    ["Scheduling resource capacity exceeded", "The selected resource is fully booked at this time. Choose another resource or time."],
  ]) {
    const error = appointmentPersistenceError({ code: "P0001", message });
    assert.equal(normalizeActionError(error, "Generic failure"), expected);
  }
});

test("appointment infrastructure errors and unexpected database text stay private", () => {
  for (const source of [
    { code: "PGRST202", message: "Could not find public.save_appointment_with_staff in the schema cache" },
    { code: "42702", message: 'column reference "service_id" is ambiguous' },
    { code: "P0001", message: "Unexpected error with confidential data" },
    { code: "23505", message: "duplicate key value contains confidential data" },
  ]) {
    const error = appointmentPersistenceError(source);
    assert.equal(normalizeActionError(error, "Generic failure"), "Generic failure");
    assert.equal(error.cause, source);
  }
});

test("appointment authorization failures give safe recovery guidance", () => {
  const error = appointmentPersistenceError({ code: "42501", message: "permission denied for table appointments" });
  assert.equal(normalizeActionError(error, "Generic failure"), "You no longer have access to save this appointment. Refresh and check your organization and branch.");
});

test("legacy required-vehicle constraint explains why a Salon booking is blocked", () => {
  const error = appointmentPersistenceError({ code: "23502", message: 'null value in column "vehicle_id" of relation "appointments" violates not-null constraint' });
  assert.equal(normalizeActionError(error, "Generic failure"), "Appointments without a vehicle are currently unavailable. Ask an administrator to complete appointment setup.");
  const other = appointmentPersistenceError({ code: "23502", message: 'null value in column "customer_id" of relation "appointments" violates not-null constraint' });
  assert.equal(normalizeActionError(other, "Generic failure"), "Generic failure");
});
