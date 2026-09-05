import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  evaluateStaffNotificationEligibility,
  saveStaffProfileInputSchema,
  staffProfileInvitationInputSchema,
} from "../modules/core/staff/staff.service";

const organizationId = "5a200000-0000-4000-8000-000000000001";

test("Staff profiles permit no login contacts and normalize optional values", () => {
  const result = saveStaffProfileInputSchema.safeParse({
    staffId: null,
    organizationId,
    fullName: "  Nina Cruz  ",
    email: "",
    mobile: null,
    jobFunction: "Nail Technician",
    specializations: ["Manicure"],
    isActive: true,
    branchIds: ["5a400000-0000-4000-8000-000000000001"],
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.fullName, "Nina Cruz");
    assert.equal(result.data.email, null);
    assert.equal(result.data.mobile, null);
  }
});

test("Staff profile validation rejects invalid contact and repeated branch identity", () => {
  const branchId = "5a400000-0000-4000-8000-000000000001";
  const result = saveStaffProfileInputSchema.safeParse({
    staffId: null,
    organizationId,
    fullName: "Nina Cruz",
    email: "not-an-email",
    mobile: "123",
    jobFunction: null,
    specializations: [],
    isActive: true,
    branchIds: [branchId, branchId],
  });
  assert.equal(result.success, false);
  if (!result.success) assert.deepEqual(new Set(result.error.issues.map(({ path }) => path[0])), new Set(["email", "mobile", "branchIds"]));
});

test("Staff profile service normalizes valid contact before persistence", () => {
  const result = saveStaffProfileInputSchema.parse({
    staffId: null,
    organizationId,
    fullName: "Alex Reyes",
    email: " ALEX@EXAMPLE.TEST ",
    mobile: "0917 123 4567",
    jobFunction: null,
    specializations: [],
    isActive: true,
    branchIds: [],
  });
  assert.equal(result.email, "alex@example.test");
  assert.equal(result.mobile, "+639171234567");
});

test("login invitation remains a separate explicit operation", () => {
  assert.equal(staffProfileInvitationInputSchema.safeParse({
    staffId: "5a300000-0000-4000-8000-000000000004",
    loginEmail: "nina@example.test",
    role: "technician",
    branchIds: [],
    expiresHours: 72,
  }).success, true);
  assert.equal(staffProfileInvitationInputSchema.safeParse({
    staffId: "5a300000-0000-4000-8000-000000000004",
    loginEmail: "",
    role: "technician",
    branchIds: [],
    expiresHours: 72,
  }).success, false);
});

test("Staff notification eligibility reuses shared both/email/mobile/neither and opt-out rules", () => {
  assert.deepEqual(evaluateStaffNotificationEligibility({ channel: "email", email: null, mobile: null, optedIn: true }), { eligible: false, reason: "EMAIL_MISSING" });
  assert.deepEqual(evaluateStaffNotificationEligibility({ channel: "sms", email: null, mobile: null, optedIn: true }), { eligible: false, reason: "SMS_MISSING" });
  assert.deepEqual(evaluateStaffNotificationEligibility({ channel: "email", email: "member@example.test", mobile: "+639171234567", optedIn: false }), { eligible: false, reason: "EMAIL_OPTED_OUT" });
  assert.deepEqual(evaluateStaffNotificationEligibility({ channel: "email", email: "Member@Example.Test", optedIn: true }), { eligible: true, reason: "ELIGIBLE", recipientAddress: "member@example.test" });
  assert.deepEqual(evaluateStaffNotificationEligibility({ channel: "sms", mobile: "0917 123 4567", optedIn: true }), { eligible: true, reason: "ELIGIBLE", recipientAddress: "+639171234567" });
});

test("Core Staff boundary and canonical scheduling stay vertical-neutral", () => {
  const coreSources = [
    "modules/core/staff/staff.types.ts",
    "modules/core/staff/staff.service.ts",
    "modules/core/staff/staff.runtime.ts",
    "modules/core/availability/availability.runtime.ts",
    "modules/core/scheduling/appointment-assignment-view.ts",
  ].map((file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8")).join("\n");
  assert.doesNotMatch(coreSources, /modules\/automotive|\bvehicle\b|\bVIN\b/i);
  const hardening = readFileSync(new URL("../supabase/migrations/0056_optional_staff_identity_hardening.sql", import.meta.url), "utf8");
  assert.match(hardening, /user_id uuid/);
  assert.match(hardening, /access_branch_ids uuid\[\]/);
  assert.match(hardening, /save_maintenance_appointment_with_staff/);
});
