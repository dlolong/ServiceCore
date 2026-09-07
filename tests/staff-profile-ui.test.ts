import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  staffAccessStatusLabel,
  staffContactLabel,
  staffProfileAccessSchema,
  staffProfileInvitationSchema,
  staffProfileSchema,
} from "../app/dashboard/settings/staff/staff-forms";

const staffId = "39000000-0000-4000-8000-000000000002";
const branchId = "49000000-0000-4000-8000-000000000001";

test("Staff profile validation accepts absent contacts and normalizes provided contacts", () => {
  const withoutContact = staffProfileSchema.parse({ staffId: "", fullName: "  Alex Cruz  ", email: "", mobile: "", jobFunction: "", specializations: "", isActive: true, branchIds: [] });
  assert.equal(withoutContact.staffId, null);
  assert.equal(withoutContact.fullName, "Alex Cruz");
  assert.equal(withoutContact.email, null);
  assert.equal(withoutContact.mobile, null);

  const withContact = staffProfileSchema.parse({ staffId, fullName: "Alex Cruz", email: " ALEX@EXAMPLE.COM ", mobile: "0917 123 4567", jobFunction: " Stylist ", specializations: " Hair Color, Hair Color, Facials ", isActive: true, branchIds: [branchId] });
  assert.equal(withContact.email, "alex@example.com");
  assert.equal(withContact.mobile, "+639171234567");
  assert.deepEqual(withContact.specializations, ["Hair Color", "Facials"]);
});

test("Staff profile validation rejects invalid nonblank contacts", () => {
  const base = { staffId: "", fullName: "Alex Cruz", jobFunction: "", specializations: "", isActive: true, branchIds: [] };
  const invalidEmail = staffProfileSchema.safeParse({ ...base, email: "invalid", mobile: "" });
  const invalidMobile = staffProfileSchema.safeParse({ ...base, email: "", mobile: "1234" });
  assert.equal(invalidEmail.success, false);
  assert.equal(invalidMobile.success, false);
  if (!invalidEmail.success) assert.equal(invalidEmail.error.issues[0]?.message, "Enter a valid email address or leave it blank.");
  if (!invalidMobile.success) assert.equal(invalidMobile.error.issues[0]?.message, "Enter a valid Philippine mobile number or leave it blank.");
  assert.equal(staffProfileSchema.safeParse({ ...base, fullName: "", email: "", mobile: "" }).success, false);
  assert.equal(staffProfileSchema.safeParse({ ...base, fullName: "A".repeat(121), email: "", mobile: "" }).success, false);
  assert.equal(staffProfileSchema.safeParse({ ...base, email: "", mobile: "", isActive: null }).success, false);
});

test("System access validation stays independent from Staff contact and operational status", () => {
  assert.equal(staffProfileInvitationSchema.safeParse({ staffId, loginEmail: "login@example.com", role: "technician", branchIds: [branchId], expiresHours: "72" }).success, true);
  assert.equal(staffProfileInvitationSchema.safeParse({ staffId, loginEmail: "", role: "owner", branchIds: [], expiresHours: "999" }).success, false);
  assert.equal(staffProfileAccessSchema.safeParse({ staffId, role: "viewer", isActive: false, branchIds: [] }).success, true);
});

test("Staff contact and access presentation uses calm explicit fallbacks", () => {
  assert.equal(staffContactLabel(null, "No email"), "No email");
  assert.equal(staffAccessStatusLabel("active"), "Active access");
  assert.equal(staffAccessStatusLabel("disabled"), "Disabled access");
  assert.equal(staffAccessStatusLabel("pending"), "Invitation pending");
  assert.equal(staffAccessStatusLabel("none"), "No access");
});

test("Staff settings use canonical profile RPCs, safe directory reads, dialogs, and stable responsive IDs", () => {
  const page = readFileSync(new URL("../app/dashboard/settings/staff/page.tsx", import.meta.url), "utf8");
  const runtime = readFileSync(new URL("../modules/core/staff/staff.runtime.ts", import.meta.url), "utf8");
  const actions = readFileSync(new URL("../app/dashboard/settings/staff/actions.ts", import.meta.url), "utf8");
  const presentation = readFileSync(new URL("../components/staff-management.tsx", import.meta.url), "utf8");

  assert.match(page, /loadStaffManagementDirectory/);
  assert.match(page, /listOperationalStaffDirectory/);
  assert.match(page, /listStaffScheduleAssignments/);
  assert.match(runtime, /staff_directory/);
  assert.match(runtime, /staff_profile_id/);
  assert.doesNotMatch(page, /rpc\("list_staff"/);
  assert.doesNotMatch(page, /from\("organization_memberships"/);
  for (const service of ["saveStaffProfileService", "inviteStaffProfileService", "updateStaffProfileAccessService"]) assert.match(actions, new RegExp(service));
  assert.doesNotMatch(actions, /\.rpc\("(?:save_staff_profile|create_staff_profile_invitation|update_staff_profile_access)"/);
  for (const id of ["salon-staff-table", "salon-staff-mobile-list", "staff-table", "staff-mobile-list", "-create-dialog", "-edit-dialog", "-access-dialog", "-login-email-input", "-access-status-"]) {
    assert.match(`${page}\n${presentation}`, new RegExp(id));
  }
  assert.match(presentation, /Contact details are optional and do not create a login/);
  assert.match(presentation, /No contact details/);
  assert.match(presentation, /Optional — used for Staff notifications when available/);
  assert.match(presentation, /Optional — used for Staff notifications or account invitations when available/);
  assert.match(presentation, /This changes login access only/);
  assert.match(page, /Owner system access is protected/);
});
